const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const backup = './backup';
const output = './csv';
fs.mkdirSync(output, { recursive: true });

const idMap = {};
function getUUID(firebaseId) {
  if (!firebaseId) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firebaseId)) {
    idMap[firebaseId] = firebaseId;
    return firebaseId;
  }
  if (!idMap[firebaseId]) idMap[firebaseId] = uuidv4();
  return idMap[firebaseId];
}

function saveSql(filename, table, rows, chunkSize = 500, conflictTarget = 'id') {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunkRows = rows.slice(i, i + chunkSize);
    const valuesList = chunkRows.map(r => {
      return '(' + columns.map(c => {
        const v = r[c];
        if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return 'NULL';
        if (typeof v === 'boolean' || typeof v === 'number') return v;
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(', ') + ')';
    }).join(',\n  ');
    chunks.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES \n  ${valuesList}\nON CONFLICT (${conflictTarget}) DO NOTHING;`);
  }

  if (chunks.length === 1) {
    fs.writeFileSync(`${output}/${filename}.sql`, chunks[0]);
  } else {
    chunks.forEach((chunk, i) => {
      fs.writeFileSync(`${output}/${filename}_part${i + 1}.sql`, chunk);
    });
  }
}

// ─── REGISTROS CONHECIDOS ──────────────────────────────────────────────
const knownTurmas = new Set();
const knownSecoes = new Set();
const knownLocais = new Set();
const knownDisciplinas = new Set();
const knownDocentes = new Set();

function transformTurmas() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/turmas.json`));
  const turmasRows = [];
  const secoesRows = [];
  raw.forEach(t => {
    const id = getUUID(String(t.id));
    knownTurmas.add(id);
    const ano = parseInt(t.entryYear || t.anoIngresso) || new Date().getFullYear();
    const esq = 2027 - ano;
    turmasRows.push({
      id, nome: t.name || t.nome, ano_ingresso: ano,
      esquadrao: (esq >= 1 && esq <= 4) ? esq : 1,
      cor_hex: (t.color || t.cor || '').startsWith('#') ? t.color || t.cor : null,
      total_cadetes: t.totalCadetes || 190, ativo: true
    });
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(s => {
      const sid = getUUID(`secao-${id}-${s}`);
      knownSecoes.add(sid);
      secoesRows.push({ id: sid, turma_id: id, secao: s, tipo: (s === 'E' ? 'INT' : s === 'F' ? 'INF' : 'AVI'), qtd_alunos: 40 });
    });
  });
  saveSql('turmas', 'turmas', turmasRows, 500, 'id');
  saveSql('turma_secoes', 'turma_secoes', secoesRows, 500, 'id');
  console.log(`✓ turmas e seções geradas`);
}

function transformLocais() {
  const disciplines = JSON.parse(fs.readFileSync(`${backup}/disciplinas.json`));
  const events = JSON.parse(fs.readFileSync(`${backup}/programacao.json`));
  const locSet = new Set();
  disciplines.forEach(d => { if (d.location) locSet.add(d.location); });
  events.forEach(e => { if (e.location) locSet.add(e.location); });
  const rows = Array.from(locSet).map(name => {
    const id = getUUID(`local-${name}`);
    knownLocais.add(id);
    let tipo = 'OUTRO';
    const n = String(name).toUpperCase();
    if (n.includes('SALA') || n.includes('AULA')) tipo = 'SALA_AULA';
    else if (n.includes('LAB')) tipo = 'LABORATORIO';
    else if (n.includes('CAMPO') || n.includes('EIA')) tipo = 'CAMPO';
    else if (n.includes('SIMULADOR')) tipo = 'SIMULADOR';
    else if (n.includes('SEF')) tipo = 'SEF';
    return { id, nome: name, tipo, capacidade: n.includes('SALA') ? 40 : null, codigo: null, ativo: true };
  });
  saveSql('locais', 'locais', rows, 500, 'id');
  console.log(`✓ locais gerados`);
}

function transformDisciplinas() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/disciplinas.json`));
  const usedSiglas = {};
  const rows = raw.map(d => {
    const id = getUUID(d.id);
    knownDisciplinas.add(id);
    let ano = parseInt(d.year);
    if (isNaN(ano)) ano = null;
    let siglaOriginal = (d.code || d.sigla || 'SEM_SIGLA').toUpperCase().substring(0, 10);
    let siglaUnica = siglaOriginal;
    let counter = 2;
    while (usedSiglas[siglaUnica]) {
      siglaUnica = siglaOriginal.substring(0, 7) + '_' + counter;
      counter++;
    }
    usedSiglas[siglaUnica] = true;
    return {
      id, sigla: siglaUnica, nome: d.name || d.nome, 
      categoria: (d.trainingField === 'PROFISSIONAL' ? 'PROFISSIONAL' : d.trainingField === 'ATIVIDADES_COMPLEMENTARES' ? 'ATIVIDADES_COMPLEMENTARES' : 'GERAL'),
      carga_horaria: d.load_hours || d.cargaHoraria || 0, ano_curso: ano, campo: d.trainingField || null, ativo: true
    };
  });
  saveSql('disciplinas', 'disciplinas', rows, 500, 'sigla');
  console.log(`✓ disciplinas geradas`);
}

function transformDocentes() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/docentes.json`));
  const rows = raw.map(d => {
    const id = getUUID(d.trigram || d.id);
    knownDocentes.add(id);
    const trigrama = (d.trigram || d.trigrama || d.id || '???').toUpperCase().substring(0, 3);
    return {
      id, trigrama, nome_guerra: d.warName || d.nomeGuerra || trigrama,
      nome_completo: d.fullName || null,
      vinculo: (d.venture || '').toUpperCase() === 'QOCON' ? 'GOCON' : 'EFETIVO',
      titulacao: d.rank || d.maxTitle || null, carga_horaria_max: d.weeklyLoadLimit || 12, ativo: true
    };
  });
  saveSql('docentes', 'docentes', rows, 500, 'trigrama');
  console.log(`✓ docentes geradas`);
}

function transformProgramacao() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/programacao.json`));
  const turmasRaw = JSON.parse(fs.readFileSync(`${backup}/turmas.json`));
  const squadronToTurmaId = {};
  turmasRaw.forEach(t => {
    const esq = 2027 - (parseInt(t.entryYear || t.anoIngresso) || 0);
    squadronToTurmaId[esq] = getUUID(String(t.id));
  });

  const phantomTurmas = [];
  const phantomSecoes = [];
  const phantomDisciplinas = [];
  const phantomLocais = [];

  const rows = raw.filter(a => a.date && a.startTime && a.endTime && a.disciplineId).map(a => {
    const esq = parseInt(a.targetSquadron || (a.classId ? a.classId[0] : null));
    if (!esq || isNaN(esq)) return null;

    let turmaId = squadronToTurmaId[esq];
    if (!turmaId) {
      turmaId = getUUID(`turma-phantom-${esq}`);
      squadronToTurmaId[esq] = turmaId;
      if (!knownTurmas.has(turmaId)) {
        phantomTurmas.push({ id: turmaId, nome: `Esquadrão ${esq} (Histórico)`, ano_ingresso: 2027-esq, esquadrao: (esq >= 1 && esq <= 4) ? esq : 1, cor_hex: '#aaaaaa', total_cadetes: 190, ativo: false });
        knownTurmas.add(turmaId);
      }
    }

    const secaoRaw = (a.targetClass || (a.classId ? a.classId.slice(-1) : 'A')).toUpperCase();
    const secaoChar = secaoRaw.substring(0, 1);
    const secaoId = getUUID(`secao-${turmaId}-${secaoChar}`);
    if (!knownSecoes.has(secaoId)) {
      phantomSecoes.push({ id: secaoId, turma_id: turmaId, secao: secaoChar, tipo: 'AVI', qtd_alunos: 40 });
      knownSecoes.add(secaoId);
    }

    const discId = getUUID(a.disciplineId);
    if (!knownDisciplinas.has(discId)) {
      phantomDisciplinas.push({ id: discId, sigla: `H${discId.substring(0, 8)}`.toUpperCase(), nome: `Disciplina Histórica (${a.disciplineId})`, categoria: 'GERAL', carga_horaria: 0, ativo: false });
      knownDisciplinas.add(discId);
    }

    let localId = null;
    if (a.location) {
        localId = getUUID(`local-${a.location}`);
        if (!knownLocais.has(localId)) {
            phantomLocais.push({ id: localId, nome: a.location, tipo: 'OUTRO', ativo: false });
            knownLocais.add(localId);
        }
    }

    const toTime = t => (t && t.length === 5) ? `${t}:00` : t;
    return {
      id: getUUID(a.id), data: a.date, horario_inicio: toTime(a.startTime), horario_fim: toTime(a.endTime),
      turma_id: turmaId, secao_id: secaoId, disciplina_id: discId,
      docente_id: null, local_id: localId,
      status: 'confirmada', dia_letivo_num: a.dayNumber || null, semana_num: a.weekNumber || null
    };
  }).filter(r => r);

  if (phantomTurmas.length) saveSql('turmas_phantom', 'turmas', phantomTurmas);
  if (phantomSecoes.length) saveSql('secoes_phantom', 'turma_secoes', phantomSecoes);
  if (phantomDisciplinas.length) saveSql('disciplinas_phantom', 'disciplinas', phantomDisciplinas, 300, 'sigla');
  if (phantomLocais.length) saveSql('locais_phantom', 'locais', phantomLocais);

  saveSql('programacao_aulas', 'programacao_aulas', rows, 50, 'id');
  console.log(`✓ programação gerada`);
}

transformTurmas();
transformLocais();
transformDisciplinas();
transformDocentes();
transformProgramacao();
fs.writeFileSync('./backup/id-map.json', JSON.stringify(idMap, null, 2));
console.log(`\n✅ Sucesso! SQLs regenerados com registros fantasmas inclusive disciplinas ausentes.`);
