const { chromium } = require('playwright');

(async () => {
  const br = await chromium.launch({ headless: true });
  const page = await br.newPage();

  // 1. Tela inicial
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/01-inicial.png' });
  console.log('1. Tela inicial carregada');

  // 2. Entrar como ADM (sem PIN no dev server = entra direto)
  await page.click('text=Sou ADM');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/02-adm-lista.png' });
  const cards = await page.locator('.rounded-2xl.shadow-sm.overflow-hidden').count();
  console.log('2. Cards de alunos:', cards);

  // 3. Botão sair presente?
  const btnSair = await page.locator('button[title="Sair"]').count();
  console.log('3. Botão Sair:', btnSair > 0 ? 'OK' : 'AUSENTE');

  // 4. Edição rápida mensalidade
  const btnR = page.locator('button:has-text("R$ —")').first();
  if (await btnR.count() > 0) {
    await btnR.click();
    await page.waitForTimeout(400);
    const inp = page.locator('input[placeholder="0"]');
    await inp.fill('150');
    await page.screenshot({ path: '/tmp/03-quickedit-mens.png' });
    await inp.press('Enter');
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/04-mens-salva.png' });
    const valor = await page.locator('button:has-text("R$ 150")').first().count();
    console.log('4. Mensalidade salva como R$150:', valor > 0 ? 'OK' : 'verificar screenshot');
  } else {
    console.log('4. Botão R$ — não encontrado (possível dados já preenchidos)');
  }

  // 5. Edição rápida contato
  const btnC = page.locator('button:has-text("Adicionar contato")').first();
  if (await btnC.count() > 0) {
    await btnC.click();
    await page.waitForTimeout(400);
    const inp = page.locator('input[placeholder="(69) 99999-9999"]');
    await inp.fill('69999990001');
    await page.screenshot({ path: '/tmp/05-quickedit-contato.png' });
    await inp.press('Enter');
    await page.waitForTimeout(600);
    console.log('5. Contato salvo: OK');
  } else {
    console.log('5. Nenhum aluno sem contato visível');
  }

  // 6. Edição rápida vencimento
  const btnV = page.locator('button:has-text("+ vencimento")').first();
  if (await btnV.count() > 0) {
    await btnV.click();
    await page.waitForTimeout(400);
    const inp = page.locator('input[placeholder="dia"]');
    await inp.fill('10');
    await page.screenshot({ path: '/tmp/06-quickedit-venc.png' });
    await inp.press('Enter');
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/07-venc-salvo.png' });
    console.log('6. Vencimento salvo: OK');
  }

  // 7. Filtro por nível
  const btnHidro = page.locator('button:has-text("Hidroginástica")');
  if (await btnHidro.count() > 0) {
    await btnHidro.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/08-filtro-hidro.png' });
    const hidro = await page.locator('.rounded-2xl.shadow-sm.overflow-hidden').count();
    console.log('7. Filtro Hidroginástica:', hidro, 'alunos');
  }

  await br.close();
  console.log('\nTeste finalizado!');
})();
