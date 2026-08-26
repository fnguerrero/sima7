/* tools/validar.js — corre el validador de niveles fuera del navegador.
   Uso:  node tools/validar.js
   Sirve para verificar los 10 niveles sin tener que jugarlos a mano. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const base = path.join(__dirname, '..', 'js');
['core.js', 'tiles.js', 'levels.js', 'validator.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
});

const resultados = G.validador.validarTodos();
let fallos = 0;

resultados.forEach(function (r) {
  const estado = r.ok ? 'OK  ' : 'FALLA';
  console.log(
    estado + ' | nivel ' + String(r.numero).padStart(2) +
    ' | ' + r.nombre.padEnd(22) +
    ' | apoyos ' + String(r.alcanzados || 0).padStart(4) + '/' + String(r.apoyos || 0).padEnd(4)
  );
  r.errores.forEach(function (e) { console.log('        ERROR: ' + e); });
  r.avisos.forEach(function (a) { console.log('        aviso: ' + a); });
  if (!r.ok) fallos++;
});

console.log('\n' + (resultados.length - fallos) + '/' + resultados.length + ' niveles válidos');
process.exit(fallos ? 1 : 0);
