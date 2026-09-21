export type GuideMethod = 'copy' | 'htm' | 'mailsignature' | 'phone';

export interface Guide {
  id: string;
  family: 'Gmail' | 'Outlook' | 'Apple Mail';
  title: string;
  method: GuideMethod;
  steps: string[];
  note?: string;
}

/**
 * Install steps, current as of the plan date (2026). Mail apps change these menus often, so each
 * path should be re-verified on real devices every release (see docs/compat).
 */
export const GUIDES: Guide[] = [
  {
    id: 'gmail-web',
    family: 'Gmail',
    title: 'Gmail on the web',
    method: 'copy',
    steps: [
      'Click "Copy formatted signature" below.',
      'In Gmail open Settings (the gear) → See all settings → General.',
      'Scroll to Signature, choose "Create new" (or edit one) and paste with Ctrl/Cmd+V.',
      'Under "Signature defaults" pick it for new emails and replies, then Save Changes.',
    ],
    note: 'Gmail limits a signature to 10,000 characters. The builder blocks the copy if yours is over.',
  },
  {
    id: 'gmail-mobile',
    family: 'Gmail',
    title: 'Gmail app (iOS / Android)',
    method: 'phone',
    steps: [
      'The Gmail app can only set a plain-text mobile signature. Instead, turn the mobile signature OFF so the app uses the web signature for Google accounts.',
      'In the Gmail app: Menu → Settings → your account → Mobile Signature → turn it off.',
      'Set the signature on Gmail web (above); it will be used when you send from the app.',
    ],
    note: 'No paste needed on the phone. If your account is not a Google account, use the send-to-phone page instead.',
  },
  {
    id: 'outlook-web',
    family: 'Outlook',
    title: 'Outlook on the web and new Outlook',
    method: 'copy',
    steps: [
      'Click "Copy formatted signature" below.',
      'Open Settings → Accounts → Signatures (new Outlook) or Settings → Mail → Compose and reply (outlook.com).',
      'Choose "New signature", paste with Ctrl/Cmd+V, and choose your defaults.',
      'Save.',
    ],
  },
  {
    id: 'outlook-classic',
    family: 'Outlook',
    title: 'Classic Outlook for Windows',
    method: 'htm',
    steps: [
      'Download the .htm file below.',
      'Press Win+R, type %APPDATA%\\Microsoft\\Signatures and press Enter.',
      'Copy the downloaded .htm into that folder, then restart Outlook.',
      'File → Options → Mail → Signatures and pick it. (Or paste the copied signature there.)',
    ],
    note: 'Outlook 2016 and 2019 show only the first frame of each GIF, which is why frame 1 is always complete. Microsoft 365 builds animate.',
  },
  {
    id: 'outlook-mac',
    family: 'Outlook',
    title: 'Outlook for Mac',
    method: 'copy',
    steps: [
      'Click "Copy formatted signature" below.',
      'Outlook → Settings → Signatures → +.',
      'Paste into the editor, name it, and choose your defaults.',
    ],
  },
  {
    id: 'outlook-mobile',
    family: 'Outlook',
    title: 'Outlook app (iOS / Android)',
    method: 'phone',
    steps: [
      'Open the send-to-phone page on your phone (QR code or link below).',
      'Tap "Copy signature".',
      'In Outlook: Settings → your account → Signature, and paste.',
    ],
    note: 'Formatting support in the mobile Outlook signature box varies by version. Recent Microsoft 365 builds can sync signatures from the web instead.',
  },
  {
    id: 'apple-mac',
    family: 'Apple Mail',
    title: 'Mail on macOS',
    method: 'mailsignature',
    steps: [
      'Mail → Settings → Signatures → + to create a placeholder signature, and note its name.',
      'Quit Mail completely.',
      'Download the .mailsignature file below and replace the placeholder file in ~/Library/Mail/V10/MailData/Signatures/ (the placeholder is the newest file there; V-number varies).',
      'Right-click the new file → Get Info → tick "Locked" so Mail does not reformat it, then reopen Mail.',
    ],
    note: 'Pasting also works for simple designs. The file route keeps everything intact.',
  },
  {
    id: 'apple-ios',
    family: 'Apple Mail',
    title: 'Mail on iPhone / iPad',
    method: 'phone',
    steps: [
      'Open the send-to-phone page on your phone (QR code or link below) and tap "Copy signature".',
      'Settings → Apps → Mail → Signature (older iOS: Settings → Mail → Signature), and paste.',
      'If the formatting looks lost, shake the phone and choose "Undo Change Attributes" to restore it.',
    ],
  },
  {
    id: 'icloud',
    family: 'Apple Mail',
    title: 'iCloud Mail on the web',
    method: 'copy',
    steps: [
      'The iCloud signature editor has limited formatting. We recommend sending from the Mail apps above.',
      'If you still want to try: iCloud Mail → Settings → Composing → Signature, and paste.',
    ],
  },
];
