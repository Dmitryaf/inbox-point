import { VkSetup, DeliveryPanel, BackupPanel } from './ServiceTools';
import { TelegramSetup } from './TelegramSetup';
export { TelegramSetup } from './TelegramSetup';
export function SetupPage() {
  return (
    <main>
      <h1>Messenger Handoff</h1>
      <TelegramSetup />
      <VkSetup />
      <section aria-labelledby="content-title">
        <h2 id="content-title">Информация для клиентов</h2>
        <p>
          <a href="/manage">Открыть редактор информации</a>
        </p>
      </section>
      <DeliveryPanel />
      <BackupPanel />
    </main>
  );
}
