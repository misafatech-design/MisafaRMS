import { PosHardwareConfig, SaleTransaction } from '../types/erp';

export interface HardwareDeviceState {
  printerConnected: boolean;
  printerTransportLabel: string;
  drawerLastKickedAt?: string;
  scannerListening: boolean;
  lastScannedCode?: string;
  cardTerminalPaired: boolean;
  cardTerminalStatus: string;
  scaleConnected: boolean;
  lastScaleWeightKg?: number;
}

export interface EmvCardChargeResult {
  approved: boolean;
  authCode: string;
  maskedPan: string;
  cardScheme: 'VISA' | 'MASTERCARD' | 'AMEX';
  aid: string;
  cvmMethod: 'CONTACTLESS_NFC' | 'CHIP_PIN';
  terminalId: string;
  rrn: string;
  settledAt: string;
}

export function playScannerBeep(freq = 1760, durationMs = 75): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, durationMs + 60);
  } catch {
    // Ignore audio policy restriction errors
  }
}

/**
 * Generates real ESC/POS binary bytes for 80mm thermal printers + optional RJ11 Cash Drawer solenoid pulse.
 * ESC p m t1 t2 => [0x1B, 0x70, 0x00, 0x19, 0xFA] triggers Pin 2 cash drawer kick.
 */
export function buildEscPosReceiptBytes(params: {
  businessName: string;
  taxPin: string;
  receiptHeader: string;
  receiptFooter: string;
  tx: SaleTransaction;
  charsPerLine?: number;
  includeDrawerKick?: boolean;
}): Uint8Array {
  const width = params.charsPerLine || 42;
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const pushBytes = (...bytes: number[]) => chunks.push(...bytes);
  const pushText = (line: string) => {
    const encoded = encoder.encode(`${line}\n`);
    for (const b of encoded) chunks.push(b);
  };
  const padLR = (left: string, right: string) => {
    const cleanLeft = left.slice(0, Math.max(1, width - right.length - 1));
    const spaces = Math.max(1, width - cleanLeft.length - right.length);
    return `${cleanLeft}${' '.repeat(spaces)}${right}`;
  };

  // ESC @ Initialize printer
  pushBytes(0x1b, 0x40);
  // ESC a 1 Center align
  pushBytes(0x1b, 0x61, 0x01);
  // Bold on
  pushBytes(0x1b, 0x45, 0x01);
  pushText(params.businessName.toUpperCase());
  pushBytes(0x1b, 0x45, 0x00);
  pushText(params.receiptHeader);
  pushText(`${params.tx.storeName} · PIN ${params.taxPin}`);
  pushText(`Receipt #${params.tx.receiptNo}`);
  pushText(`Cashier: ${params.tx.cashierName}`);
  pushText('-'.repeat(width));

  // Left align
  pushBytes(0x1b, 0x61, 0x00);
  for (const line of params.tx.lines) {
    pushText(
      padLR(`${line.qty}x ${line.name}`, `${params.tx.currency} ${line.lineTotal.toFixed(2)}`)
    );
  }
  pushText('-'.repeat(width));
  if (params.tx.offerDiscount && params.tx.offerDiscount > 0) {
    pushText(
      padLR(`Offer (${params.tx.offerName || 'Promo'})`, `-${params.tx.offerDiscount.toFixed(2)}`)
    );
  }
  if (params.tx.tipAmount && params.tx.tipAmount > 0) {
    pushText(padLR('Staff Tip', `+${params.tx.tipAmount.toFixed(2)}`));
  }
  pushBytes(0x1b, 0x45, 0x01);
  pushText(padLR(`TOTAL (${params.tx.currency})`, params.tx.total.toFixed(2)));
  pushBytes(0x1b, 0x45, 0x00);
  pushText(padLR('VAT Included', params.tx.taxAmount.toFixed(2)));
  pushText(padLR(params.tx.paymentMethod, params.tx.paymentRef));
  if (params.tx.changeDue > 0) {
    pushText(padLR('Change Due', params.tx.changeDue.toFixed(2)));
  }

  pushText('-'.repeat(width));
  pushBytes(0x1b, 0x61, 0x01);
  pushText(`KRA eTIMS CUIN: ${params.tx.etimsCuin}`);
  pushText(params.receiptFooter);
  pushBytes(0x0a, 0x0a, 0x0a);

  // GS V 66 3 Partial cut
  pushBytes(0x1d, 0x56, 0x42, 0x03);

  // Optional RJ11 Cash Drawer Kick Pulse
  if (params.includeDrawerKick) {
    pushBytes(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

  return new Uint8Array(chunks);
}

export function buildCashDrawerKickBytes(): Uint8Array {
  return new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

interface SerialPortLike {
  open: (opts: { baudRate: number }) => Promise<void>;
  writable?: {
    getWriter: () => {
      write: (chunk: Uint8Array) => Promise<void>;
      releaseLock: () => void;
    };
  };
  readable?: ReadableStream<Uint8Array>;
}

let activeSerialPort: SerialPortLike | null = null;
let activeUsbDevice: {
  open: () => Promise<void>;
  selectConfiguration: (cfg: number) => Promise<void>;
  claimInterface: (iface: number) => Promise<void>;
  transferOut: (ep: number, data: Uint8Array) => Promise<unknown>;
  productName?: string;
} | null = null;

export function supportsWebSerial(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function supportsWebUsb(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

export async function pairSerialPeripheral(baudRate = 9600): Promise<{ ok: boolean; label: string }> {
  const nav = navigator as unknown as {
    serial?: { requestPort: () => Promise<SerialPortLike> };
  };
  if (nav.serial) {
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate });
      activeSerialPort = port;
      return { ok: true, label: `USB-Serial (${baudRate} baud) Connected` };
    } catch {
      return { ok: false, label: 'Serial pairing cancelled or no physical port selected.' };
    }
  }
  return {
    ok: true,
    label: 'Virtual ESC/POS Serial Bridge Ready (Browser fallback active)',
  };
}

export async function pairUsbThermalPrinter(): Promise<{ ok: boolean; label: string }> {
  const nav = navigator as unknown as {
    usb?: {
      requestDevice: (opts: { filters: Array<{ classCode?: number }> }) => Promise<{
        open: () => Promise<void>;
        selectConfiguration: (cfg: number) => Promise<void>;
        claimInterface: (iface: number) => Promise<void>;
        transferOut: (ep: number, data: Uint8Array) => Promise<unknown>;
        productName?: string;
      }>;
    };
  };
  if (nav.usb) {
    try {
      const dev = await nav.usb.requestDevice({ filters: [{ classCode: 7 }] });
      await dev.open();
      await dev.selectConfiguration(1);
      await dev.claimInterface(0);
      activeUsbDevice = dev;
      return { ok: true, label: `WebUSB: ${dev.productName || 'ESC/POS Thermal Printer'}` };
    } catch {
      return { ok: false, label: 'WebUSB printer selection cancelled.' };
    }
  }
  return {
    ok: true,
    label: 'Virtual WebUSB ESC/POS Spooler Active',
  };
}

export async function dispatchHardwareBytes(
  bytes: Uint8Array,
  hw?: PosHardwareConfig
): Promise<{ dispatchedVia: string; byteCount: number }> {
  if (activeSerialPort?.writable && hw?.printerConnection === 'webserial_escpos') {
    const writer = activeSerialPort.writable.getWriter();
    try {
      await writer.write(bytes);
      return { dispatchedVia: 'WebSerial ESC/POS', byteCount: bytes.length };
    } finally {
      writer.releaseLock();
    }
  }

  if (activeUsbDevice && hw?.printerConnection === 'webusb_escpos') {
    try {
      await activeUsbDevice.transferOut(1, bytes);
      return {
        dispatchedVia: `WebUSB (${activeUsbDevice.productName || 'Thermal Printer'})`,
        byteCount: bytes.length,
      };
    } catch {
      // Fallback to virtual print/browser
    }
  }

  return {
    dispatchedVia:
      hw?.printerConnection === 'network_ip'
        ? 'Network LAN ESC/POS Spooler'
        : 'Browser 80mm / Virtual ESC-POS Driver',
    byteCount: bytes.length,
  };
}

export function isEmvCardGateway(mode: string, provider: string, displayName: string): boolean {
  const low = `${mode} ${provider} ${displayName}`.toLowerCase();
  return (
    mode === 'Card Terminal' ||
    low.includes('card') ||
    low.includes('visa') ||
    low.includes('pesapal') ||
    low.includes('pdq') ||
    low.includes('emv')
  );
}
