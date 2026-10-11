export type AriaToggleState = {
  'aria-pressed': boolean;
  role: 'button';
};

export function getAriaToggleState(pressed: boolean): AriaToggleState {
  return {
    role: 'button',
    'aria-pressed': pressed,
  };
}

export type AriaLiveState = {
  'aria-live': 'polite' | 'assertive' | 'off';
  'aria-atomic': boolean;
};

export function getAriaLiveState(
  priority: AriaLiveState['aria-live'] = 'polite',
): AriaLiveState {
  return {
    'aria-live': priority,
    'aria-atomic': true,
  };
}

export function getDialogA11yProps(labelledBy: string): {
  role: 'dialog';
  'aria-modal': true;
  'aria-labelledby': string;
} {
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': labelledBy,
  };
}
