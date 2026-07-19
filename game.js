import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

const RECIPIENT_ADDRESS = '0x96657b2A74d1D8617C627D13EdF49F4734e6C097';
const BASE_CHAIN_ID_HEX = '0x2105'; // Base mainnet (8453)

const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn');
const tipSection = document.getElementById('tipSection');
const amountsEl = document.getElementById('amounts');
const customAmountInput = document.getElementById('customAmount');
const customSendBtn = document.getElementById('customSendBtn');
const resultEl = document.getElementById('result');
const totalTipsEl = document.getElementById('totalTips');
const jarEl = document.getElementById('jar');
const coinEl = document.getElementById('coinFly');

let provider = null;
let account = null;
let selectedAmount = null;
let tipCount = 0;

function setStatus(text, connected) {
  statusEl.textContent = text;
  statusEl.classList.toggle('connected', !!connected);
}

function shortAddress(addr) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function showResult(text, isError) {
  resultEl.textContent = text;
  resultEl.classList.toggle('error', !!isError);
  resultEl.classList.toggle('success', !isError && !!text);
}

function playJarAnimation() {
  jarEl.classList.add('bounce');
  coinEl.classList.remove('fly');
  void coinEl.offsetWidth;
  coinEl.classList.add('fly');
  setTimeout(() => jarEl.classList.remove('bounce'), 150);
}

function ethToWeiHex(ethAmountStr) {
  const eth = Number(ethAmountStr);
  const wei = BigInt(Math.round(eth * 1e18));
  return '0x' + wei.toString(16);
}

async function getProvider() {
  if (provider) return provider;
  try {
    const inMiniApp = await sdk.isInMiniApp();
    if (inMiniApp) {
      const sdkProvider = await sdk.wallet.getEthereumProvider();
      if (sdkProvider) {
        provider = sdkProvider;
        return provider;
      }
    }
  } catch (err) {
    // not running inside a Farcaster/Base host, fall back to injected provider
  }
  if (window.ethereum) {
    provider = window.ethereum;
  }
  return provider;
}

async function ensureBaseNetwork(p) {
  const chainId = await p.request({ method: 'eth_chainId' });
  if (chainId === BASE_CHAIN_ID_HEX) return;
  try {
    await p.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    if (switchError && switchError.code === 4902) {
      await p.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_CHAIN_ID_HEX,
          chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } else {
      throw switchError;
    }
  }
}

async function connectWallet() {
  connectBtn.disabled = true;
  try {
    const p = await getProvider();
    if (!p) {
      setStatus('Cüzdan bulunamadı', false);
      return;
    }
    const accounts = await p.request({ method: 'eth_requestAccounts' });
    account = accounts[0];
    await ensureBaseNetwork(p);
    setStatus('Bağlandı: ' + shortAddress(account), true);
    connectBtn.classList.add('hidden');
    tipSection.classList.remove('hidden');
  } catch (err) {
    console.error('connectWallet error:', err);
    setStatus('Bağlantı hatası', false);
  } finally {
    connectBtn.disabled = false;
  }
}

async function sendTip(amountEth) {
  if (!account) return;
  if (!amountEth || Number(amountEth) <= 0) {
    showResult('Geçerli bir miktar gir', true);
    return;
  }
  showResult('Gönderiliyor...', false);
  try {
    const p = await getProvider();
    const txHash = await p.request({
      method: 'eth_sendTransaction',
      params: [{
        from: account,
        to: RECIPIENT_ADDRESS,
        value: ethToWeiHex(amountEth),
      }],
    });
    tipCount += 1;
    totalTipsEl.textContent = 'Bu oturumda gönderilen: ' + tipCount + ' tip';
    showResult('Teşekkürler! Tx: ' + shortAddress(txHash), false);
    playJarAnimation();
  } catch (err) {
    showResult('Gönderim başarısız', true);
  }
}

connectBtn.addEventListener('click', connectWallet);

amountsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.amount-btn');
  if (!btn) return;
  document.querySelectorAll('.amount-btn').forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedAmount = btn.dataset.amount;
  sendTip(selectedAmount);
});

customSendBtn.addEventListener('click', () => {
  sendTip(customAmountInput.value);
});

sdk.actions.ready();
