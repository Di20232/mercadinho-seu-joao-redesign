// Horário da loja. O servidor pode rodar em UTC (Docker, nuvem), mas o
// mercadinho vive no horário de Brasília: "hoje", a hora de uma venda e o dia
// em que ela cai dependem disso, e não do relógio do servidor.
const STORE_TIME_ZONE = 'America/Sao_Paulo';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

const textFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: STORE_TIME_ZONE,
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function storeParts(date) {
  const parts = {};
  for (const { type, value } of partsFormat.formatToParts(date)) parts[type] = value;
  return parts;
}

// "AAAA-MM-DD" do dia na loja.
function storeToday(now = new Date()) {
  const p = storeParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

// "25/11/2026 22:00" no horário da loja.
function formatStoreDateTime(date) {
  return textFormat.format(date).replace(',', '');
}

// Um Date cujos campos UTC são o relógio da loja. Serve para o Excel, que
// guarda data e hora sem fuso: a célula mostra a hora de Brasília e continua
// sendo data (ordena e filtra como data, e não como texto).
function storeWallClock(date) {
  const p = storeParts(date);
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second), date.getUTCMilliseconds()));
}

module.exports = { STORE_TIME_ZONE, storeToday, formatStoreDateTime, storeWallClock };
