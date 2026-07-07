// WHBAR → HBAR unwrapper via SaucerSwap's WhbarHelper
// https://docs.saucerswap.finance/v/developer/whbar/unwrap-whbar-for-hbar

import {
  DAppConnector,
  HederaChainId,
  HederaJsonRpcMethod,
  HederaSessionEvent,
} from '@hashgraph/hedera-wallet-connect';
import {
  AccountAllowanceApproveTransaction,
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  LedgerId,
  Long,
  TokenId,
  Transaction,
  TransactionId,
  type Signer,
} from '@hiero-ledger/sdk';

// ── config (edited in index.html) ───────────────────────────────────
declare global {
  interface Window {
    APP_CONFIG: { PROJECT_ID: string; NETWORK: 'mainnet' | 'testnet' };
  }
}
const { PROJECT_ID, NETWORK } = window.APP_CONFIG;

const CFG = {
  mainnet: { token: '0.0.1456986', helper: '0.0.5808826', mirror: 'https://mainnet.mirrornode.hedera.com' },
  testnet: { token: '0.0.15058', helper: '0.0.5286055', mirror: 'https://testnet.mirrornode.hedera.com' },
}[NETWORK];

const DECIMALS = 8; // WHBAR smallest unit == tinybar

// ── amount helpers ──────────────────────────────────────────────────
const toWad = (amount: string): Long => {
  const [whole = '0', frac = ''] = amount.trim().split('.');
  if (frac.length > DECIMALS) throw new Error(`Max ${DECIMALS} decimal places`);
  return Long.fromString(whole + frac.padEnd(DECIMALS, '0'));
};

const fromWad = (raw: Long): string => {
  const s = raw.toString().padStart(DECIMALS + 1, '0');
  const frac = s.slice(-DECIMALS).replace(/0+$/, '');
  return s.slice(0, -DECIMALS) + (frac ? '.' + frac : '');
};

// ── dom ─────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const connectBtn = $<HTMLButtonElement>('connect-btn');
const unwrapBtn = $<HTMLButtonElement>('unwrap-btn');
const balanceBtn = $<HTMLButtonElement>('balance-btn');
const amountInput = $<HTMLInputElement>('amount');
const walletUi = $('wallet-ui');
const accountEl = $('account-id');
const receiveEl = $('receive');
const statusEl = $('status');
const fatalEl = $('fatal');

$('network-badge').textContent = NETWORK;

// ── state ───────────────────────────────────────────────────────────
let connector: DAppConnector;
let accountId: string | undefined;
let balance: Long | undefined;
let busy = false;

function fatal(message: string) {
  fatalEl.textContent = message;
  fatalEl.hidden = false;
  connectBtn.hidden = true;
}

function status(message: string, kind: 'ok' | 'err' | '' = '') {
  statusEl.textContent = message;
  statusEl.className = `msg ${kind}`;
  statusEl.hidden = !message;
}

function render() {
  const connected = Boolean(accountId);
  connectBtn.hidden = connected;
  walletUi.hidden = !connected;
  if (!connected) return;

  accountEl.textContent = accountId!;
  balanceBtn.textContent = balance ? `${fromWad(balance)} WHBAR` : '';
  receiveEl.textContent = `${amountInput.value || '0'} HBAR`;

  let valid = false;
  try {
    const wad = toWad(amountInput.value || '0');
    valid = wad.gt(0) && (!balance || wad.lte(balance));
  } catch {
    valid = false;
  }
  unwrapBtn.disabled = busy || !valid;
}

function syncAccount() {
  accountId = connector.signers[0]?.getAccountId().toString();
  if (accountId) refreshBalance();
  render();
}

async function refreshBalance() {
  if (!accountId) return;
  try {
    const res = await fetch(`${CFG.mirror}/api/v1/accounts/${accountId}/tokens?token.id=${CFG.token}`);
    const data = await res.json();
    balance = Long.fromString(String(data.tokens?.[0]?.balance ?? 0));
  } catch {
    balance = undefined;
  }
  render();
}

// ── contract calls: approve allowance, then unwrapWhbar(wad) ────────
// The wallet library's populateTransaction doesn't set node accounts,
// so freezeWithSigner fails ("nodeAccountId must be set"). We set the
// transaction ID and node accounts ourselves and freeze manually.
const NODE_ACCOUNTS = [3, 4, 5].map((n) => new AccountId(n)); // valid on mainnet & testnet

function prepare<T extends Transaction>(tx: T, owner: string): T {
  tx.setTransactionId(TransactionId.generate(AccountId.fromString(owner)));
  tx.setNodeAccountIds(NODE_ACCOUNTS);
  return tx.freeze() as T;
}

async function unwrap(signer: Signer, owner: string, wad: Long) {
  status('Step 1/2 - approve the allowance in your wallet...');
  const approve = prepare(
    new AccountAllowanceApproveTransaction().approveTokenAllowance(
      TokenId.fromString(CFG.token),
      AccountId.fromString(owner),
      AccountId.fromString(CFG.helper),
      wad,
    ),
    owner,
  );
  const approveReceipt = await (await approve.executeWithSigner(signer)).getReceiptWithSigner(signer);
  if (approveReceipt.status.toString() !== 'SUCCESS') throw new Error(`Approval failed: ${approveReceipt.status}`);

  status('Step 2/2 - confirm the unwrap in your wallet...');
  const call = prepare(
    new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(CFG.helper))
      .setGas(1_000_000)
      .setFunction('unwrapWhbar', new ContractFunctionParameters().addUint256(wad)),
    owner,
  );
  const receipt = await (await call.executeWithSigner(signer)).getReceiptWithSigner(signer);
  if (receipt.status.toString() !== 'SUCCESS') throw new Error(`Unwrap failed: ${receipt.status}`);
}

// ── wire up ─────────────────────────────────────────────────────────
connectBtn.addEventListener('click', async () => {
  try {
    await connector.openModal();
    syncAccount();
  } catch (e) {
    status(e instanceof Error ? e.message : 'Wallet connection failed', 'err');
  }
});

balanceBtn.addEventListener('click', () => {
  if (balance) {
    amountInput.value = fromWad(balance);
    render();
  }
});

amountInput.addEventListener('input', () => {
  amountInput.value = amountInput.value.replace(/[^0-9.]/g, '');
  status('');
  render();
});

unwrapBtn.addEventListener('click', async () => {
  if (!accountId) return;
  const signer = connector.signers.find((s) => s.getAccountId().toString() === accountId) as unknown as Signer;
  busy = true;
  render();
  try {
    await unwrap(signer, accountId, toWad(amountInput.value));
    status('Unwrapped - HBAR is in your wallet.', 'ok');
    amountInput.value = '';
    refreshBalance();
  } catch (e) {
    status(e instanceof Error ? e.message : 'Transaction failed', 'err');
  } finally {
    busy = false;
    render();
  }
});

// ── init ────────────────────────────────────────────────────────────
(async () => {
  if (!PROJECT_ID || PROJECT_ID.startsWith('PASTE_')) {
    return fatal('Set your WalletConnect project ID in index.html (window.APP_CONFIG). Free at cloud.reown.com.');
  }
  connector = new DAppConnector(
    { name: 'WHBAR Unwrapper', description: 'Unwrap WHBAR to HBAR', url: window.location.origin, icons: [] },
    NETWORK === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET,
    PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [NETWORK === 'mainnet' ? HederaChainId.Mainnet : HederaChainId.Testnet],
  );
  await connector.init({ logger: 'error' });
  if (!connector.walletConnectClient) {
    return fatal('WalletConnect failed to initialize - check the browser console for "Error initializing DAppConnector".');
  }
  connector.walletConnectClient.on('session_delete', syncAccount);
  connectBtn.textContent = 'Connect wallet';
  connectBtn.disabled = false;
  syncAccount(); // restores a persisted session if one exists
})();
