// app/verify.js — browser-side Merkle proof verification via @txline/verify.
// Lazy-imported ONLY when the user taps "verify this tick" (see window.BATTLE.
// verifyBrowser in index.html), so @solana/web3.js never touches page load.
//
// This is the independent second check that runs entirely in the viewer's browser:
// it reconstructs the fixture-summary Merkle root from the proof nodes (pure hashing,
// the tamper-detecting step) and compares it against the root the TxLINE oracle
// anchored in the mainnet daily_scores_roots PDA — read READ-ONLY, no wallet, no
// signing, no SOL. The engine's verify=1 verdict is the same math done server-side;
// showing both = "verified twice, independently, in your browser and by the engine."
import './buffer-shim.js'; // MUST be first: sets globalThis.Buffer before web3 evaluates
import { verifyScoresStatProofOnChain } from '@txline/verify';
import { Connection } from '@solana/web3.js';

// Same-origin RPC: Vite proxies /rpc → mainnet (the public endpoint 403s browser
// getAccountInfo, so we go through the dev server, exactly like /v1). Override ?rpc=.
function rpcEndpoint() {
  try {
    const q = new URLSearchParams(location.search).get('rpc');
    if (q) return q;
    return location.origin + '/rpc';
  } catch { return 'https://api.mainnet-beta.solana.com'; }
}

// `engineProof` is the `.proof` object from /v1/validation/scores
// (i.e. client.validateScores(...).proof). Returns the verify SDK's structured
// result: { verified, computedRootHex, onChainRootHex, subTreeVerified,
// mainTreeVerified, pdaEpochDayMatches, statLeavesVerified, failureMode, pda,
// programId, epochDay, ... }. Throws only on RPC error (never for a bad proof).
export async function verifyProofInBrowser(engineProof, rpcUrl = rpcEndpoint()) {
  const conn = new Connection(rpcUrl, 'confirmed');
  // 3rd arg = injected account reader (the Connection); mainnet program by default.
  return verifyScoresStatProofOnChain('', engineProof, conn);
}
