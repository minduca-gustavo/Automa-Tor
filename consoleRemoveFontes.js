(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  function waitFor(fn, label, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function tick() {
        let v; try { v = fn(); } catch(e) {}
        if (v) return resolve(v);
        if (Date.now() - t0 > timeout) return reject(new Error('timeout: ' + label));
        setTimeout(tick, 300);
      })();
    });
  }

  function findByText(selector, text) {
    const wanted = norm(text);
    const nodes = [...document.querySelectorAll(selector)].filter(visible);
    return nodes.find(el => norm(el.textContent) === wanted)
        || nodes.find(el => norm(el.textContent).includes(wanted))
        || null;
  }

  function checkedContainers() {
    return [...document.querySelectorAll('.single-source-container')].filter(c =>
      c.querySelector('mat-checkbox.mat-mdc-checkbox-checked') ||
      c.querySelector('input[type="checkbox"]')?.checked
    );
  }

  const total = checkedContainers().length;
  if (!total) { console.log('Nenhuma fonte marcada.'); return; }
  console.log(`Removendo ${total} fonte(s)...`);

  let done = 0;
  while (done < 500) {
    const [c] = checkedContainers();
    if (!c) break;

    const more = c.querySelector('button.source-item-more-button, button.mat-mdc-menu-trigger');
    if (!more) { console.warn('Botão "mais" não encontrado, pulando.'); break; }
    more.click();
    await sleep(1000);

    const remover = await waitFor(() => findByText('button.mat-mdc-menu-item, [role="menuitem"]', 'remover fonte'), '"Remover fonte"');
    remover.click();

    const excluir = await waitFor(() => {
      const ov = document.querySelector('.cdk-overlay-container');
      if (!ov) return null;
      const btns = [...ov.querySelectorAll('button')].filter(visible);
      return btns.find(b => norm(b.textContent) === 'excluir')
          || btns.find(b => norm(b.textContent).includes('excluir'))
          || null;
    }, '"Excluir"');
    excluir.click();

    await waitFor(() => !document.contains(c), 'remoção do item');
    done++;
    console.log(`  ✓ ${done}/${total}`);
    await sleep(600);
  }

  console.log(`Pronto: ${done} fonte(s) removida(s).`);
})();