import { expect, test, type Page } from '@playwright/test';

type RecoveryWindow = Window & {
  __NEURAL_BRUSH_TEST__?: {
    editedChecksum(): number | null;
  };
  __CRASH_BRAIN_WORKER__?: () => void;
};

async function selectNeuronByType(page: Page, type: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Neuron' }).evaluate(
    (element, requestedType) => {
      const select = element as HTMLSelectElement;
      const match = Array.from(select.options).find((option) =>
        option.textContent?.includes(requestedType),
      );
      if (!match) throw new Error(`${requestedType} neuron option is missing`);
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
    type,
  );
}

async function setRange(page: Page, name: string, value: string): Promise<void> {
  await page.getByRole('slider', { name }).evaluate((element, nextValue) => {
    const slider = element as HTMLInputElement;
    slider.value = nextValue;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('worker crash preserves artwork and current modulation until Restart Brain succeeds', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const recoveryWindow = window as RecoveryWindow;
    const NativeWorker = window.Worker;
    let crashLatest: (() => void) | null = null;

    class WorkerProxy extends EventTarget {
      onmessage: ((event: MessageEvent<unknown>) => unknown) | null = null;
      onerror: ((event: ErrorEvent) => unknown) | null = null;
      onmessageerror: ((event: MessageEvent<unknown>) => unknown) | null = null;
      private readonly inner: Worker;

      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super();
        this.inner = new NativeWorker(scriptURL, options);
        crashLatest = () => {
          if (!this.onerror) throw new Error('Brain worker error handler is unavailable');
          this.onerror(
            new ErrorEvent('error', {
              message: 'synthetic worker crash',
            }),
          );
        };
        this.inner.onmessage = (event) => this.onmessage?.(event);
        this.inner.onerror = (event) => this.onerror?.(event);
        this.inner.onmessageerror = (event) => this.onmessageerror?.(event);
      }

      postMessage(message: unknown, transfer?: Transferable[]): void {
        if (transfer) this.inner.postMessage(message, transfer);
        else this.inner.postMessage(message);
      }

      terminate(): void {
        this.inner.terminate();
      }
    }

    window.Worker = WorkerProxy as unknown as typeof Worker;
    recoveryWindow.__CRASH_BRAIN_WORKER__ = () => {
      if (!crashLatest) throw new Error('Brain worker proxy is unavailable');
      crashLatest();
    };
  });

  await page.goto('/?debug=1');
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Choose photo').setInputFiles('tests/fixtures/brush-image.png');
  await expect(page.getByText('brush-image.png')).toBeVisible();

  await selectNeuronByType(page, 'DNa01');
  await setRange(page, 'Stimulation', '0.37');

  const readChecksum = () =>
    page.evaluate(
      () => (window as RecoveryWindow).__NEURAL_BRUSH_TEST__?.editedChecksum() ?? null,
    );
  await expect.poll(readChecksum).not.toBeNull();
  await page.waitForTimeout(200);

  await page.evaluate(() => (window as RecoveryWindow).__CRASH_BRAIN_WORKER__?.());
  await expect(page.getByText('MaleCNS circuit: error')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Brain worker crashed: synthetic worker crash');

  const restartButton = page.getByRole('button', { name: 'Restart Brain' });
  await expect(restartButton).toBeVisible();
  await expect(restartButton).toBeEnabled();
  await expect(page.getByText('brush-image.png')).toBeVisible();

  const checksumAtFailure = await readChecksum();
  await page.waitForTimeout(250);
  expect(await readChecksum()).toBe(checksumAtFailure);

  await restartButton.click();
  await expect(page.getByText('MaleCNS circuit: brain ready')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('brush-image.png')).toBeVisible();
  await selectNeuronByType(page, 'DNa01');
  await expect(page.getByRole('slider', { name: 'Stimulation' })).toHaveValue('0.37');

  await expect.poll(readChecksum, { timeout: 4_000 }).not.toBe(checksumAtFailure);
});
