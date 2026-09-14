#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEFAULT_HEALTH_TIMEOUT_SECONDS=180

project=''
env_file=''
public_url=''
health_timeout_seconds=$DEFAULT_HEALTH_TIMEOUT_SECONDS
current_step='validate arguments'
previous_commit='not resolved'
target_commit='not resolved'
snapshot_report='not created'
backup_container_id=''

usage() {
  cat <<'EOF'
Usage:
  ./deploy/update-instance.sh \
    --project <compose-project> \
    --env <instance-env-file> \
    --public-url <https-origin> \
    [--health-timeout <seconds>]
EOF
}

current_commit() {
  git rev-parse --verify 'HEAD^{commit}' 2>/dev/null || printf '%s' 'not resolved'
}

failure_report() {
  local exit_code=$1
  local reason=$2
  local deployed_commit

  set +e
  deployed_commit=$(current_commit)
  printf '\nInbox Point update failed.\n' >&2
  printf 'Failure stage: %s\n' "$current_step" >&2
  printf 'Reason: %s\n' "$reason" >&2
  printf 'Previous commit: %s\n' "$previous_commit" >&2
  printf 'Target commit: %s\n' "$target_commit" >&2
  printf 'Current commit: %s\n' "$deployed_commit" >&2
  printf 'Pre-deploy snapshot: %s\n' "$snapshot_report" >&2
  if [[ -n "$backup_container_id" ]]; then
    printf 'Snapshot copy container: %s\n' "$backup_container_id" >&2
    printf 'Inspect it with: docker logs %q\n' "$backup_container_id" >&2
  fi
  printf 'No automatic rollback was attempted.\n' >&2
  if [[ -n "$project" && -n "$env_file" ]]; then
    printf 'Inspect the instance with:\n' >&2
    printf '  docker compose -p %q --env-file %q ps app\n' \
      "$project" "$env_file" >&2
    printf '  docker compose -p %q --env-file %q logs --tail=100 app\n' \
      "$project" "$env_file" >&2
  fi
  exit "$exit_code"
}

abort() {
  failure_report 1 "$1"
}

unexpected_error() {
  local exit_code=$1
  failure_report "$exit_code" "unexpected command failure (line ${BASH_LINENO[0]})"
}

trap 'unexpected_error $?' ERR

while (($# > 0)); do
  case "$1" in
    --project)
      (($# >= 2)) || abort '--project requires a value'
      project=$2
      shift 2
      ;;
    --env)
      (($# >= 2)) || abort '--env requires a value'
      env_file=$2
      shift 2
      ;;
    --public-url)
      (($# >= 2)) || abort '--public-url requires a value'
      public_url=$2
      shift 2
      ;;
    --health-timeout)
      (($# >= 2)) || abort '--health-timeout requires a value'
      health_timeout_seconds=$2
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      abort "unknown argument: $1"
      ;;
  esac
done

[[ -n "$project" ]] || abort '--project is required'
[[ -n "$env_file" ]] || abort '--env is required'
[[ -n "$public_url" ]] || abort '--public-url is required'
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] ||
  abort '--project must contain only lowercase letters, digits, hyphens, and underscores'
[[ "$health_timeout_seconds" =~ ^[1-9][0-9]*$ ]] ||
  abort '--health-timeout must be a positive integer'
[[ "$public_url" =~ ^https://[^/@?#[:space:]]+/?$ ]] ||
  abort '--public-url must be an HTTPS origin without credentials, path, query, or fragment'
public_url=${public_url%/}

if [[ ! -f "$env_file" || ! -r "$env_file" ]]; then
  abort '--env must point to a readable file'
fi
env_directory=$(cd "$(dirname "$env_file")" && pwd -P)
env_file="$env_directory/$(basename "$env_file")"

for command_name in git docker curl awk; do
  command -v "$command_name" >/dev/null 2>&1 ||
    abort "required command is unavailable: $command_name"
done

current_step='locate repository'
script_directory=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
if ! repository_root=$(git -C "$script_directory/.." rev-parse --show-toplevel); then
  abort 'the updater is not inside a Git repository'
fi
cd "$repository_root"

current_step='check tracked working tree'
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  abort 'tracked working-tree or index changes must be resolved first'
fi

current_step='resolve current branch and remote'
if ! branch=$(git symbolic-ref --quiet --short HEAD); then
  abort 'HEAD must be attached to a branch'
fi
if ! remote=$(git config --get "branch.$branch.remote"); then
  abort "branch $branch has no configured upstream remote"
fi
if [[ -z "$remote" || "$remote" == '.' ]]; then
  abort "branch $branch must track a remote branch"
fi
if ! upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'); then
  abort "branch $branch has no configured upstream branch"
fi
previous_commit=$(current_commit)

current_step="fetch remote $remote"
if ! git fetch --prune "$remote"; then
  abort "git fetch failed for remote $remote"
fi
if ! target_commit=$(git rev-parse --verify "${upstream}^{commit}"); then
  abort "cannot resolve upstream commit $upstream"
fi

printf 'Current commit: %s\n' "$previous_commit"
printf 'Target commit:  %s\n' "$target_commit"

if [[ "$previous_commit" != "$target_commit" ]] &&
  ! git merge-base --is-ancestor "$previous_commit" "$target_commit"; then
  current_step='verify fast-forward target'
  abort 'the upstream target is not a fast-forward from the current commit'
fi

current_step='check Docker Compose'
if ! docker compose version >/dev/null; then
  abort 'Docker Compose is unavailable'
fi
compose=(docker compose -p "$project" --env-file "$env_file")

if [[ "$previous_commit" != "$target_commit" ]]; then
  current_step='create service snapshot in the application volume'
  if ! snapshot_output=$(
    "${compose[@]}" exec -T app node dist/create-service-snapshot.js
  ); then
    abort 'service snapshot creation failed'
  fi
  internal_snapshot_path=$(
    printf '%s\n' "$snapshot_output" | awk 'NF { value=$0 } END { print value }'
  )
  if [[ ! "$internal_snapshot_path" =~ ^/app/data/snapshots/[A-Za-z0-9._-]+$ ]]; then
    abort 'snapshot tooling returned an unexpected path'
  fi
  snapshot_name=${internal_snapshot_path##*/}
  snapshot_report="app:$internal_snapshot_path (external copy not completed)"

  current_step='copy service snapshot to the configured host backup directory'
  if ! copy_container_output=$(
    "${compose[@]}" --profile operations run -d --no-deps \
      --entrypoint /bin/sh backup -c '
        set -eu
        source_path=$1
        snapshot_name=$2
        temporary_path=/backup/${snapshot_name}.copying
        final_path=/backup/${snapshot_name}
        test -d "$source_path"
        test ! -e "$temporary_path"
        test ! -e "$final_path"
        cp -a "$source_path" "$temporary_path"
        mv "$temporary_path" "$final_path"
      ' updater "$internal_snapshot_path" "$snapshot_name"
  ); then
    abort 'could not start the snapshot copy container'
  fi
  backup_container_id=$(
    printf '%s\n' "$copy_container_output" |
      awk 'NF { value=$0 } END { print value }'
  )
  if [[ ! "$backup_container_id" =~ ^[a-f0-9]{12,64}$ ]]; then
    abort 'Docker Compose returned an unexpected snapshot copy container ID'
  fi
  if ! backup_host_directory=$(
    docker inspect --format '{{range .Mounts}}{{if eq .Destination "/backup"}}{{.Source}}{{end}}{{end}}' \
      "$backup_container_id"
  ); then
    abort 'could not resolve the configured host backup directory'
  fi
  [[ -n "$backup_host_directory" ]] ||
    abort 'the backup service has no host directory mounted at /backup'
  snapshot_path="${backup_host_directory%/}/$snapshot_name"
  snapshot_report="$snapshot_path (copy not yet verified)"
  if ! copy_exit_code=$(docker wait "$backup_container_id"); then
    abort 'could not wait for the snapshot copy container'
  fi
  if [[ "$copy_exit_code" != '0' ]]; then
    abort "snapshot copy container exited with status $copy_exit_code"
  fi

  current_step='verify copied service snapshot'
  for required_file in \
    manifest.json \
    database.sqlite \
    content-settings.json \
    service-control.json; do
    if [[ ! -f "$snapshot_path/$required_file" ]]; then
      abort "copied snapshot is missing $required_file"
    fi
  done
  snapshot_report=$snapshot_path
  if ! docker rm "$backup_container_id" >/dev/null; then
    abort 'snapshot is safe, but the completed copy container could not be removed'
  fi
  backup_container_id=''

  current_step='recheck tracked working tree before source update'
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    abort 'tracked changes appeared after the snapshot; source was not updated'
  fi

  current_step='fast-forward source'
  if ! git merge --ff-only "$target_commit"; then
    abort 'fast-forward source update failed'
  fi
  if [[ "$(current_commit)" != "$target_commit" ]]; then
    abort 'HEAD does not match the fetched target after fast-forward'
  fi
else
  printf 'Source is already at the fetched target; rebuild is not needed.\n'
fi

current_step='validate Docker Compose configuration'
if ! "${compose[@]}" config --quiet; then
  abort 'Docker Compose configuration is invalid'
fi

if [[ "$previous_commit" != "$target_commit" ]]; then
  current_step='rebuild and recreate the application service'
  if ! "${compose[@]}" up -d --build app; then
    abort 'application rebuild or recreation failed'
  fi
fi

current_step='wait for application container health'
if ! app_container_id=$("${compose[@]}" ps -q app); then
  abort 'could not resolve the application container ID'
fi
[[ "$app_container_id" =~ ^[a-f0-9]{12,64}$ ]] ||
  abort 'the application service does not have exactly one container'

health_deadline=$((SECONDS + health_timeout_seconds))
while ((SECONDS < health_deadline)); do
  if ! container_state=$(
    docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
      "$app_container_id"
  ); then
    abort 'could not inspect application container health'
  fi
  case "$container_state" in
    'running healthy')
      break
      ;;
    'running unhealthy')
      abort 'application container reported unhealthy'
      ;;
    'running starting')
      sleep 2
      ;;
    *)
      abort "application container is not healthy: $container_state"
      ;;
  esac
done
if [[ "$container_state" != 'running healthy' ]]; then
  abort "application did not become healthy within ${health_timeout_seconds}s"
fi

current_step='check public HTTPS /health'
if ! curl --fail --silent --show-error --output /dev/null --max-time 15 \
  --proto '=https' "$public_url/health"; then
  abort 'public HTTPS /health check failed'
fi

current_step='check public HTTPS /ready'
if ! curl --fail --silent --show-error --output /dev/null --max-time 15 \
  --proto '=https' "$public_url/ready"; then
  abort 'public HTTPS /ready check failed'
fi

deployed_commit=$(current_commit)
if [[ "$deployed_commit" != "$target_commit" ]]; then
  abort 'deployed source commit changed unexpectedly during verification'
fi

trap - ERR
printf 'Inbox Point update succeeded.\n'
printf 'Deployed commit: %s\n' "$deployed_commit"
if [[ "$snapshot_report" != 'not created' ]]; then
  printf 'Pre-deploy snapshot: %s\n' "$snapshot_report"
fi
