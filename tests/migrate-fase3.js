/**
 * ═══════════════════════════════════════════════════════════
 *  SNGPC FASE 3 — Migration SQL
 *  Tabelas: sngpc_arquivos, sngpc_auditoria
 *  Índices: conforme BLOCO 6
 *  ENUM: status transmissao expandido
 *  Trigger: imutabilidade pós-transmissão
 * ═══════════════════════════════════════════════════════════
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  dialectOptions: { statement_timeout: 30000 }
});

const migrations = [
  // ── 1. Criar tabela sngpc_arquivos ──
  {
    name: 'CREATE TABLE sngpc_arquivos',
    sql: `CREATE TABLE IF NOT EXISTS sngpc_arquivos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
      periodo_id INTEGER NOT NULL UNIQUE REFERENCES sngpc_periodos(id) ON DELETE RESTRICT,
      nome_arquivo VARCHAR(255) NOT NULL,
      hash_arquivo VARCHAR(64) NOT NULL,
      conteudo TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      criado_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
  },

  // ── 2. Criar tabela sngpc_auditoria ──
  {
    name: 'CREATE TABLE sngpc_auditoria',
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sngpc_auditoria_acao') THEN
        CREATE TYPE enum_sngpc_auditoria_acao AS ENUM (
          'ABRIR_PERIODO', 'FECHAR_PERIODO', 'GERAR_ARQUIVO',
          'TRANSMITIR', 'REJEITAR', 'CANCELAR',
          'MOVIMENTACAO', 'VALIDAR_INTEGRIDADE'
        );
      END IF;
    END$$`
  },
  {
    name: 'CREATE TABLE sngpc_auditoria (tabela)',
    sql: `CREATE TABLE IF NOT EXISTS sngpc_auditoria (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
      periodo_id INTEGER REFERENCES sngpc_periodos(id) ON DELETE SET NULL,
      acao enum_sngpc_auditoria_acao NOT NULL,
      dados_anteriores JSONB,
      dados_novos JSONB,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      usuario_nome VARCHAR(200),
      ip_address VARCHAR(50),
      detalhes TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  },

  // ── 3. RLS para sngpc_arquivos ──
  {
    name: 'RLS policy sngpc_arquivos',
    sql: `DO $$
    BEGIN
      ALTER TABLE sngpc_arquivos ENABLE ROW LEVEL SECURITY;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sngpc_arquivos_tenant_policy') THEN
        EXECUTE 'CREATE POLICY sngpc_arquivos_tenant_policy ON sngpc_arquivos
          USING (empresa_id = current_setting(''app.current_tenant'', true)::integer)
          WITH CHECK (empresa_id = current_setting(''app.current_tenant'', true)::integer)';
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$`
  },

  // ── 4. RLS para sngpc_auditoria ──
  {
    name: 'RLS policy sngpc_auditoria',
    sql: `DO $$
    BEGIN
      ALTER TABLE sngpc_auditoria ENABLE ROW LEVEL SECURITY;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'sngpc_auditoria_tenant_policy') THEN
        EXECUTE 'CREATE POLICY sngpc_auditoria_tenant_policy ON sngpc_auditoria
          USING (empresa_id = current_setting(''app.current_tenant'', true)::integer)
          WITH CHECK (empresa_id = current_setting(''app.current_tenant'', true)::integer)';
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$`
  },

  // ── 5. Índices sngpc_arquivos ──
  {
    name: 'INDEX sngpc_arquivos(empresa_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_sngpc_arquivos_empresa ON sngpc_arquivos(empresa_id)`
  },
  {
    name: 'INDEX sngpc_arquivos(hash_arquivo)',
    sql: `CREATE INDEX IF NOT EXISTS idx_sngpc_arquivos_hash ON sngpc_arquivos(hash_arquivo)`
  },

  // ── 6. Índices sngpc_auditoria ──
  {
    name: 'INDEX sngpc_auditoria(periodo_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_sngpc_auditoria_periodo ON sngpc_auditoria(periodo_id)`
  },
  {
    name: 'INDEX sngpc_auditoria(empresa_id, timestamp)',
    sql: `CREATE INDEX IF NOT EXISTS idx_sngpc_auditoria_empresa_ts ON sngpc_auditoria(empresa_id, timestamp)`
  },
  {
    name: 'INDEX sngpc_auditoria(empresa_id, acao)',
    sql: `CREATE INDEX IF NOT EXISTS idx_sngpc_auditoria_empresa_acao ON sngpc_auditoria(empresa_id, acao)`
  },
  {
    name: 'INDEX sngpc_auditoria(usuario_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_sngpc_auditoria_usuario ON sngpc_auditoria(usuario_id)`
  },

  // ── 7. Garantir UNIQUE em sngpc_transmissoes(protocolo_anvisa) ──
  {
    name: 'UNIQUE INDEX sngpc_transmissoes(protocolo_anvisa)',
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sngpc_trans_protocolo_global_unique') THEN
        CREATE UNIQUE INDEX sngpc_trans_protocolo_global_unique ON sngpc_transmissoes(protocolo_anvisa) WHERE protocolo_anvisa IS NOT NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$`
  },

  // ── 8. Trigger de imutabilidade pós-transmissão para sngpc_movimentacoes ──
  {
    name: 'TRIGGER imutabilidade_mov_transmitido',
    sql: `
    CREATE OR REPLACE FUNCTION fn_sngpc_bloquear_movimentacao_transmitida()
    RETURNS TRIGGER AS $$
    DECLARE
      v_status TEXT;
    BEGIN
      -- Para INSERT, verificar se o periodo_id aponta para período transmitido
      IF TG_OP = 'INSERT' AND NEW.periodo_id IS NOT NULL THEN
        SELECT status INTO v_status FROM sngpc_periodos WHERE id = NEW.periodo_id;
        IF v_status = 'transmitido' THEN
          RAISE EXCEPTION 'Não é permitido inserir movimentações em período TRANSMITIDO (periodo_id=%)', NEW.periodo_id;
        END IF;
      END IF;

      -- Para UPDATE/DELETE, verificar se o registro pertence a período transmitido
      IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.periodo_id IS NOT NULL THEN
        SELECT status INTO v_status FROM sngpc_periodos WHERE id = OLD.periodo_id;
        IF v_status = 'transmitido' THEN
          RAISE EXCEPTION 'Não é permitido alterar/excluir movimentações de período TRANSMITIDO (periodo_id=%)', OLD.periodo_id;
        END IF;
      END IF;

      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`
  },
  {
    name: 'ATTACH TRIGGER ON sngpc_movimentacoes',
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sngpc_bloquear_mov_transmitida') THEN
        CREATE TRIGGER trg_sngpc_bloquear_mov_transmitida
          BEFORE INSERT OR UPDATE OR DELETE ON sngpc_movimentacoes
          FOR EACH ROW EXECUTE FUNCTION fn_sngpc_bloquear_movimentacao_transmitida();
      END IF;
    END$$`
  },

  // ── 9. Trigger de imutabilidade para sngpc_periodos (impedir UPDATE/DELETE em transmitido) ──
  {
    name: 'TRIGGER imutabilidade_periodo_transmitido',
    sql: `
    CREATE OR REPLACE FUNCTION fn_sngpc_bloquear_periodo_transmitido()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'transmitido' THEN
        -- Permitir UPDATE apenas se for rejeição (status mudando de transmitido para fechado)
        IF TG_OP = 'UPDATE' AND NEW.status = 'fechado' THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Não é permitido alterar/excluir período TRANSMITIDO (id=%)', OLD.id;
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`
  },
  {
    name: 'ATTACH TRIGGER ON sngpc_periodos',
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sngpc_bloquear_periodo_transmitido') THEN
        CREATE TRIGGER trg_sngpc_bloquear_periodo_transmitido
          BEFORE UPDATE OR DELETE ON sngpc_periodos
          FOR EACH ROW EXECUTE FUNCTION fn_sngpc_bloquear_periodo_transmitido();
      END IF;
    END$$`
  },

  // ── 10. Trigger impede DELETE em sngpc_auditoria ──
  {
    name: 'TRIGGER proibir_delete_auditoria',
    sql: `
    CREATE OR REPLACE FUNCTION fn_sngpc_proibir_delete_auditoria()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Exclusão de registros de auditoria SNGPC é PROIBIDA';
    END;
    $$ LANGUAGE plpgsql`
  },
  {
    name: 'ATTACH TRIGGER ON sngpc_auditoria (no delete)',
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sngpc_proibir_delete_auditoria') THEN
        CREATE TRIGGER trg_sngpc_proibir_delete_auditoria
          BEFORE DELETE ON sngpc_auditoria
          FOR EACH ROW EXECUTE FUNCTION fn_sngpc_proibir_delete_auditoria();
      END IF;
    END$$`
  },

  // ── 11. Expandir ENUM de sngpc_transmissoes.status se necessário ──
  {
    name: 'ADD VALUE pendente to sngpc_transmissoes status',
    sql: `DO $$
    BEGIN
      ALTER TYPE enum_sngpc_transmissoes_status ADD VALUE IF NOT EXISTS 'pendente';
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$`
  },
  {
    name: 'ADD VALUE cancelado to sngpc_transmissoes status',
    sql: `DO $$
    BEGIN
      ALTER TYPE enum_sngpc_transmissoes_status ADD VALUE IF NOT EXISTS 'cancelado';
    EXCEPTION WHEN OTHERS THEN NULL;
    END$$`
  }
];

async function runMigrations() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  SNGPC FASE 3 — Migrations');
  console.log('══════════════════════════════════════════════════\n');

  let ok = 0, fail = 0;

  for (const m of migrations) {
    try {
      await sequelize.query(m.sql);
      ok++;
      console.log('  ✅ ' + m.name);
    } catch (err) {
      // "already exists" não é erro real
      if (err.message.includes('already exists') || err.message.includes('já existe')) {
        ok++;
        console.log('  ✅ ' + m.name + ' (já existente)');
      } else {
        fail++;
        console.log('  ❌ ' + m.name + ': ' + err.message);
      }
    }
  }

  console.log('\n  Resultado: ' + ok + '/' + migrations.length + ' aplicadas, ' + fail + ' falhas\n');
  await sequelize.close();
  process.exit(fail > 0 ? 1 : 0);
}

runMigrations();
