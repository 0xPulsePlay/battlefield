// app/buffer-shim.js — make Node's Buffer global for @txline/verify + @solana/web3.js
// under the browser. Imported FIRST by app/verify.js so globalThis.Buffer is set
// before those modules evaluate (some reference Buffer at module-init time). ESM
// evaluates imported modules depth-first in order, so this runs before web3.js.
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer;
