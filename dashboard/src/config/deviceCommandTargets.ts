export const commandTargets = {
  "buzzer.trigger": import.meta.env.VITE_BUZZER_DEVICE_ID?.trim() ?? "",
  "leds.test": import.meta.env.VITE_LEDS_TEST_DEVICE_ID?.trim() ?? "",
  "leds.auto": import.meta.env.VITE_LEDS_AUTO_DEVICE_ID?.trim() ?? "",
} as const;

const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isValidDeviceId(value: string): boolean {
  return DEVICE_ID_PATTERN.test(value);
}

export const configuredDeviceIds = [
  ...new Set(Object.values(commandTargets).filter(isValidDeviceId)),
];
