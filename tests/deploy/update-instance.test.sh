#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_UNDER_TEST=${1:-deploy/update-instance.sh}
readonly OLD_COMMIT=1111111111111111111111111111111111111111
readonly NEW_COMMIT=2222222222222222222222222222222222222222

failures=0
temporary_directories=()

cleanup() {
  local directory
  for directory in "${temporary_directories[@]}"; do
    rm -rf -- "$directory"
  done
}
trap cleanup EXIT

fail() {
  printf 'not ok - %s\n' "$1" >&2
  failures=$((failures + 1))
}

pass() {
  printf 'ok - %s\n' "$1"
}

assert_contains() {
  local file=$1
  local expected=$2
  local description=$3
  if grep -Fq -- "$expected" "$file"; then
    pass "$description"
  else
    fail "$description"
  fi
}

assert_not_contains() {
  local file=$1
  local unexpected=$2
  local description=$3
  if grep -Fq -- "$unexpected" "$file"; then
    fail "$description"
  else
    pass "$description"
  fi
}

assert_before() {
  local file=$1
  local earlier=$2
  local later=$3
  local description=$4
  local earlier_line
  local later_line
  earlier_line=$(
    grep -Fn -- "$earlier" "$file" | head -n 1 | cut -d: -f1 || true
  )
  later_line=$(grep -Fn -- "$later" "$file" | head -n 1 | cut -d: -f1 || true)
  if [[ -n "$earlier_line" && -n "$later_line" ]] &&
    ((earlier_line < later_line)); then
    pass "$description"
  else
    fail "$description"
  fi
}

copy_container_name() {
  sed -n 's/.* --name \([^ ]*\) --entrypoint \/bin\/sh.*/\1/p' "$1" |
    head -n 1
}

new_fixture() {
  fixture_result=$(mktemp -d)
  temporary_directories+=("$fixture_result")
  mkdir -p "$fixture_result/repository/deploy" "$fixture_result/bin" \
    "$fixture_result/backups"
  cp "$SCRIPT_UNDER_TEST" "$fixture_result/repository/deploy/update-instance.sh"
  printf '%s\n' "$OLD_COMMIT" >"$fixture_result/current-commit"
  printf 'ADMIN_PASSWORD=must-not-appear\n' >"$fixture_result/instance.env"

  cat >"$fixture_result/bin/git" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'git %s\n' "$*" >>"$FAKE_COMMAND_LOG"
if [[ ${1:-} == '-C' ]]; then
  shift 2
fi
case "$*" in
  'rev-parse --show-toplevel') printf '%s\n' "$FAKE_REPOSITORY" ;;
  'status --porcelain --untracked-files=no')
    [[ ${FAKE_DIRTY:-0} == 1 ]] && printf '%s\n' ' M tracked-file'
    ;;
  'symbolic-ref --quiet --short HEAD') printf '%s\n' main ;;
  'config --get branch.main.remote') printf '%s\n' origin ;;
  "rev-parse --abbrev-ref --symbolic-full-name @{upstream}") printf '%s\n' origin/main ;;
  'fetch --prune origin') ;;
  "rev-parse --verify HEAD^{commit}") cat "$FAKE_CURRENT_COMMIT" ;;
  "rev-parse --verify origin/main^{commit}") printf '%s\n' "$FAKE_TARGET_COMMIT" ;;
  "merge-base --is-ancestor $FAKE_OLD_COMMIT $FAKE_TARGET_COMMIT") ;;
  "merge --ff-only $FAKE_TARGET_COMMIT")
    printf '%s\n' "$FAKE_TARGET_COMMIT" >"$FAKE_CURRENT_COMMIT"
    ;;
  *) printf 'Unexpected fake git call: %s\n' "$*" >&2; exit 70 ;;
esac
EOF

  cat >"$fixture_result/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'docker %s\n' "$*" >>"$FAKE_COMMAND_LOG"
if [[ ${1:-} == compose ]]; then
  case " $* " in
    *' version '*) exit 0 ;;
    *' exec -T app node dist/create-service-snapshot.js '*)
      printf '%s\n' '/app/data/snapshots/inbox-point.instance.snapshot-test'
      ;;
    *' --profile operations run -T --no-deps --name '*' --entrypoint /bin/sh backup -c '*)
      arguments=("$@")
      copy_container_name=''
      for ((index = 0; index < ${#arguments[@]}; index++)); do
        if [[ ${arguments[$index]} == '--name' ]]; then
          copy_container_name=${arguments[$((index + 1))]}
          break
        fi
      done
      [[ -n "$copy_container_name" ]] || exit 73
      printf '%s\n' "$copy_container_name" >"$FAKE_COPY_CONTAINER_NAME_FILE"
      if [[ ${FAKE_COPY_FAILURE:-0} == 1 ]]; then
        printf '%s\n' 'synthetic copy failure' >&2
        exit 74
      fi
      snapshot="$FAKE_BACKUP_DIRECTORY/inbox-point.instance.snapshot-test"
      mkdir -p "$snapshot"
      touch "$snapshot/manifest.json" "$snapshot/database.sqlite" \
        "$snapshot/content-settings.json"
      if [[ ${FAKE_MISSING_SERVICE_CONTROL:-0} != 1 ]]; then
        touch "$snapshot/service-control.json"
      fi
      ;;
    *' config --quiet '*) exit 0 ;;
    *' up -d --build app '*) exit 0 ;;
    *' ps -q app '*)
      printf '%s\n' bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      ;;
    *) printf 'Unexpected fake compose call: %s\n' "$*" >&2; exit 71 ;;
  esac
elif [[ ${1:-} == inspect && $* == *'.Destination "/backup"'* ]]; then
  [[ ${!#} == "$(cat "$FAKE_COPY_CONTAINER_NAME_FILE")" ]] || exit 75
  printf '%s\n' "$FAKE_BACKUP_DIRECTORY"
elif [[ ${1:-} == inspect ]]; then
  printf 'running %s\n' "${FAKE_HEALTH:-healthy}"
elif [[ ${1:-} == rm ]]; then
  [[ ${2:-} == "$(cat "$FAKE_COPY_CONTAINER_NAME_FILE")" ]] || exit 76
  exit 0
elif [[ ${1:-} == logs ]]; then
  printf '%s\n' '/backup/inbox-point.instance.snapshot-test'
else
  printf 'Unexpected fake docker call: %s\n' "$*" >&2
  exit 72
fi
EOF

  cat >"$fixture_result/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'curl %s\n' "$*" >>"$FAKE_COMMAND_LOG"
EOF

  chmod +x "$fixture_result/bin/git" "$fixture_result/bin/docker" \
    "$fixture_result/bin/curl"
}

run_update() {
  local fixture=$1
  shift
  PATH="$fixture/bin:$PATH" \
    FAKE_COMMAND_LOG="$fixture/commands.log" \
    FAKE_REPOSITORY="$fixture/repository" \
    FAKE_CURRENT_COMMIT="$fixture/current-commit" \
    FAKE_OLD_COMMIT="$OLD_COMMIT" \
    FAKE_TARGET_COMMIT="$NEW_COMMIT" \
    FAKE_BACKUP_DIRECTORY="$fixture/backups" \
    FAKE_COPY_CONTAINER_NAME_FILE="$fixture/copy-container-name" \
    "$@" \
    bash "$fixture/repository/deploy/update-instance.sh" \
      --project inboxpoint-test \
      --env "$fixture/instance.env" \
      --public-url https://test.inboxpoint.example \
      --health-timeout 1
}

test_unique_copy_container_names() {
  local first_fixture
  local first_name
  local second_fixture
  local second_name

  new_fixture
  first_fixture=$fixture_result
  if ! run_update "$first_fixture" env >/dev/null 2>&1; then
    fail 'first update for unique container-name check succeeds'
    return
  fi
  first_name=$(copy_container_name "$first_fixture/commands.log")

  new_fixture
  second_fixture=$fixture_result
  if ! run_update "$second_fixture" env >/dev/null 2>&1; then
    fail 'second update for unique container-name check succeeds'
    return
  fi
  second_name=$(copy_container_name "$second_fixture/commands.log")

  if [[ -n "$first_name" && -n "$second_name" && "$first_name" != "$second_name" ]]; then
    pass 'each updater run uses a different copy container name'
  else
    fail 'each updater run uses a different copy container name'
  fi
}

test_successful_update() {
  local fixture
  local container_name
  new_fixture
  fixture=$fixture_result
  if run_update "$fixture" env >"$fixture/output.log" 2>&1; then
    pass 'successful update exits zero'
  else
    fail 'successful update exits zero'
    sed 's/^/  /' "$fixture/output.log" >&2
  fi
  assert_before "$fixture/commands.log" \
    'exec -T app node dist/create-service-snapshot.js' \
    "git merge --ff-only $NEW_COMMIT" \
    'snapshot is created before source changes'
  container_name=$(copy_container_name "$fixture/commands.log")
  if [[ "$container_name" =~ ^inboxpoint-test-snapshot-copy-[0-9]+-[0-9]+-[0-9]+$ ]]; then
    pass 'snapshot copy uses a unique instance-scoped container name'
  else
    fail 'snapshot copy uses a unique instance-scoped container name'
  fi
  assert_contains "$fixture/commands.log" \
    "run -T --no-deps --name $container_name --entrypoint /bin/sh backup" \
    'snapshot copy runs synchronously in a named container'
  assert_not_contains "$fixture/commands.log" 'run -T -d --no-deps' \
    'snapshot copy does not run detached'
  assert_not_contains "$fixture/commands.log" ' --rm ' \
    'snapshot copy container remains available until explicit removal'
  assert_not_contains "$fixture/commands.log" 'docker wait' \
    'snapshot copy does not use docker wait'
  assert_contains "$fixture/commands.log" \
    'temporary_path=/backup/${snapshot_name}.copying' \
    'snapshot copy uses the temporary copying path'
  assert_before "$fixture/commands.log" \
    'cp -a "$source_path" "$temporary_path"' \
    'mv "$temporary_path" "$final_path"' \
    'snapshot copy is atomically renamed after copying'
  assert_before "$fixture/commands.log" \
    "run -T --no-deps --name $container_name --entrypoint /bin/sh backup" \
    'docker inspect --format' \
    'named copy finishes before its container is inspected'
  assert_before "$fixture/commands.log" "docker inspect --format" \
    "docker rm $container_name" \
    'successful copy is inspected before its container is removed'
  assert_before "$fixture/commands.log" 'config --quiet' 'up -d --build app' \
    'Compose is validated before rebuilding app'
  assert_contains "$fixture/commands.log" 'https://test.inboxpoint.example/health' \
    'public health endpoint is checked'
  assert_contains "$fixture/commands.log" 'https://test.inboxpoint.example/ready' \
    'public readiness endpoint is checked'
  assert_contains "$fixture/output.log" "Deployed commit: $NEW_COMMIT" \
    'success reports the deployed commit'
  assert_not_contains "$fixture/output.log" 'must-not-appear' \
    'environment secrets are not printed'
}

test_dirty_tree_refusal() {
  local fixture
  new_fixture
  fixture=$fixture_result
  if run_update "$fixture" env FAKE_DIRTY=1 >"$fixture/output.log" 2>&1; then
    fail 'tracked changes stop the update'
  else
    pass 'tracked changes stop the update'
  fi
  assert_contains "$fixture/output.log" 'Failure stage: check tracked working tree' \
    'dirty-tree failure identifies its stage'
  assert_not_contains "$fixture/commands.log" 'git fetch' \
    'dirty-tree failure occurs before fetch'
  assert_not_contains "$fixture/commands.log" 'docker compose' \
    'dirty-tree failure does not touch Docker'
}

test_current_commit_is_not_rebuilt() {
  local fixture
  new_fixture
  fixture=$fixture_result
  if run_update "$fixture" env FAKE_TARGET_COMMIT="$OLD_COMMIT" \
    >"$fixture/output.log" 2>&1; then
    pass 'current commit verification exits zero'
  else
    fail 'current commit verification exits zero'
  fi
  assert_contains "$fixture/output.log" \
    'Source is already at the fetched target; rebuild is not needed.' \
    'current commit reports that no rebuild is needed'
  assert_not_contains "$fixture/commands.log" \
    'exec -T app node dist/create-service-snapshot.js' \
    'current commit does not create a redundant snapshot'
  assert_not_contains "$fixture/commands.log" 'up -d --build app' \
    'current commit does not rebuild the application'
  assert_contains "$fixture/commands.log" 'config --quiet' \
    'current commit still validates Compose'
  assert_contains "$fixture/commands.log" 'https://test.inboxpoint.example/ready' \
    'current commit still checks public readiness'
}

test_required_snapshot_files() {
  local fixture
  local container_name
  new_fixture
  fixture=$fixture_result
  if run_update "$fixture" env FAKE_MISSING_SERVICE_CONTROL=1 \
    >"$fixture/output.log" 2>&1; then
    fail 'incomplete copied snapshot stops the update'
  else
    pass 'incomplete copied snapshot stops the update'
  fi
  assert_contains "$fixture/output.log" \
    'Reason: copied snapshot is missing service-control.json' \
    'missing snapshot file is named'
  assert_not_contains "$fixture/commands.log" "git merge --ff-only $NEW_COMMIT" \
    'source stays unchanged when snapshot verification fails'
  container_name=$(copy_container_name "$fixture/commands.log")
  assert_contains "$fixture/output.log" \
    "Snapshot copy container: $container_name" \
    'snapshot verification failure reports the retained container name'
  assert_contains "$fixture/output.log" "docker logs $container_name" \
    'snapshot verification failure prints a safe logs command'
  assert_not_contains "$fixture/commands.log" "docker rm $container_name" \
    'failed snapshot verification retains the copy container'
}

test_copy_failure_keeps_container() {
  local fixture
  local container_name
  new_fixture
  fixture=$fixture_result
  if run_update "$fixture" env FAKE_COPY_FAILURE=1 \
    >"$fixture/output.log" 2>&1; then
    fail 'failed synchronous snapshot copy stops the update'
  else
    pass 'failed synchronous snapshot copy stops the update'
  fi
  container_name=$(copy_container_name "$fixture/commands.log")
  assert_contains "$fixture/output.log" \
    'Failure stage: copy service snapshot to the configured host backup directory' \
    'copy failure identifies its stage'
  assert_contains "$fixture/output.log" \
    "Snapshot copy container: $container_name" \
    'copy failure reports the retained container name'
  assert_contains "$fixture/output.log" "docker logs $container_name" \
    'copy failure prints a safe logs command'
  assert_not_contains "$fixture/commands.log" "docker rm $container_name" \
    'failed copy container is retained for diagnosis'
  assert_not_contains "$fixture/commands.log" "git merge --ff-only $NEW_COMMIT" \
    'source stays unchanged when snapshot copy fails'
}

test_health_failure_report() {
  local fixture
  new_fixture
  fixture=$fixture_result
  if run_update "$fixture" env FAKE_HEALTH=unhealthy \
    >"$fixture/output.log" 2>&1; then
    fail 'unhealthy application stops the update'
  else
    pass 'unhealthy application stops the update'
  fi
  assert_contains "$fixture/output.log" \
    'Failure stage: wait for application container health' \
    'health failure identifies its stage'
  assert_contains "$fixture/output.log" "Previous commit: $OLD_COMMIT" \
    'health failure reports the previous commit'
  assert_contains "$fixture/output.log" "Target commit: $NEW_COMMIT" \
    'health failure reports the target commit'
  assert_contains "$fixture/output.log" 'Pre-deploy snapshot:' \
    'health failure reports the recovery snapshot'
  assert_contains "$fixture/output.log" 'No automatic rollback was attempted.' \
    'health failure states the rollback boundary'
  assert_not_contains "$fixture/commands.log" 'curl ' \
    'public checks do not run after container health failure'
}

test_successful_update
test_unique_copy_container_names
test_dirty_tree_refusal
test_current_commit_is_not_rebuilt
test_required_snapshot_files
test_copy_failure_keeps_container
test_health_failure_report

if ((failures > 0)); then
  printf '%s shell deployment assertion(s) failed\n' "$failures" >&2
  exit 1
fi
