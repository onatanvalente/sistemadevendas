const jwt = require('jsonwebtoken');
const { Usuario, Empresa } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'sgc_jwt_secret_default';

// Middleware de autenticação via JWT
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acesso não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const usuario = await Usuario.findByPk(decoded.id, {
      include: [{ model: Empresa, attributes: ['id', 'nome', 'tipo_negocio', 'ativo'] }]
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    if (!usuario.Empresa || !usuario.Empresa.ativo) {
      return res.status(401).json({ error: 'Empresa inativa' });
    }

    req.usuario = usuario;
    req.empresa_id = usuario.empresa_id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware para verificar perfil de acesso (RBAC)
function perfil(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

// Middleware para filtrar por empresa (multi-tenant)
function tenant(req, res, next) {
  if (!req.empresa_id) {
    return res.status(400).json({ error: 'Empresa não identificada' });
  }
  // Adiciona filtro automático de empresa
  req.tenantFilter = { empresa_id: req.empresa_id };
  next();
}

module.exports = { auth, perfil, tenant };
