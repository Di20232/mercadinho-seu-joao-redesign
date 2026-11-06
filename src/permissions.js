// O que cada pessoa pode fazer além de vender. O dono (ADMIN) tem tudo;
// os outros têm só o que o dono marcou na tela de usuários.
const PERMISSIONS = {
  'sales.viewAll': 'Ver as vendas de todos',
  'sales.cancel': 'Cancelar qualquer venda',
  'reports.view': 'Ver faturamento e relatórios (e exportar)',
  'prices.manage': 'Definir preços, ver custo e lucro, importar planilha',
  'products.manage': 'Cadastrar e editar produtos (sem preço)',
  'stock.manage': 'Dar entrada, registrar perda e ver o histórico do estoque',
};
const ALL = Object.keys(PERMISSIONS);

// Modelos que já vêm marcados ao escolher o tipo de pessoa no formulário.
const TEMPLATES = {
  financeiro: { label: 'Financeiro', permissions: ['sales.viewAll', 'sales.cancel', 'reports.view', 'prices.manage'] },
  estoque: { label: 'Estoque', permissions: ['products.manage', 'stock.manage'] },
  caixa: { label: 'Caixa', permissions: [] },
};

// Caixa pode desfazer a própria venda logo depois de fechá-la (engano com o cliente no balcão).
const OWN_SALE_CANCEL_MINUTES = 10;

function effectivePermissions(user) {
  return user.role === 'ADMIN' ? ALL : (user.permissions || []).filter((p) => ALL.includes(p));
}

function can(user, permission) {
  return effectivePermissions(user).includes(permission);
}

// Libera a rota para quem tiver QUALQUER uma das permissões listadas.
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user || !permissions.some((p) => can(req.user, p))) {
      return res.status(403).json({ error: 'Sem permissão para executar esta ação.' });
    }
    next();
  };
}

module.exports = { PERMISSIONS, ALL, TEMPLATES, OWN_SALE_CANCEL_MINUTES, effectivePermissions, can, requirePermission };
