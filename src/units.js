// Unidades que admitem fração na venda: peso, volume e comprimento. Qualquer
// outra (UN, PCT, CX, DZ…) é contada, e só aceita quantidade inteira.
//
// Antes, a API vendia 0,5 de um produto vendido por unidade (teste de
// inconsistências de 24/11/2026): meia caixa, meio pacote.
//
// A tela do caixa (public/js/app.js, allowsFraction) repete esta lista para
// o campo de quantidade: ao mudar aqui, mude lá também.
const FRACTIONAL_UNITS = new Set(['KG', 'G', 'L', 'LT', 'ML', 'M', 'MT']);

function allowsFraction(unit) {
  return FRACTIONAL_UNITS.has(String(unit || '').trim().toUpperCase().replace(/\.$/, ''));
}

module.exports = { FRACTIONAL_UNITS, allowsFraction };
