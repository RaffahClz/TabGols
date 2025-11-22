# TabGols

Site simples para acompanhamento de uma tabela onde os "pontos" exibidos representam o saldo de gols (SG).

Funcionalidades:
- Adicionar times
- Criar partidas entre times
- Incrementar/decrementar gols por partida (+ / -)
- Atualização automática da tabela: agora a tabela exibe apenas **Pontos = Saldo de Gols (GF - GC)**. A interface mostra apenas o nome do time e os pontos (saldo de gols).
 - Modo Admin: há um botão "Entrar como Admin" que permite esconder/mostrar os controles de edição. A senha atual foi configurada para: **`Fayla9132Santos`** (armazenada em `localStorage` como `tabgols-admin-pass`). Você pode usar essa senha para entrar no modo admin e alterar partidas.
	- Para alterar a senha manualmente, abra o Console do navegador (F12) e rode:
		```javascript
		localStorage.setItem('tabgols-admin-pass', 'SUA_NOVA_SENHA');
		```
		- Entrando no modo Admin (desktop e mobile):
			- Desktop: atalho `Ctrl+Alt+A` ou clicar 5x rápido no título; também é possível clicar no canto inferior direito (hotspot discreto).
			- Mobile: toque longo (~700ms) no canto inferior direito (hotspot) ou toque longo no título ativará a tela de login.
	 - Futuramente posso adicionar uma função segura de alteração de senha no próprio UI (apenas admin).
 - Persistência local via `localStorage`

Como usar localmente:
1. Abra `index.html` no seu navegador (arrastar para a janela do navegador funciona).

Comandos (PowerShell):

```powershell
# abrir em Windows: (substitua o caminho se necessário)
Start-Process "c:\Users\rafae\Downloads\TabGols\index.html"
```

Próximos passos (posso implementar se quiser):
- Gerar tabela com todas as rodadas automaticamente (cronograma completo)
- Hospedagem (GitHub Pages) com um clique
- Autenticação e multi-usuário
 
Hospedagem (GitHub Pages) - deploy automático
 - Adicionei um workflow GitHub Actions (`.github/workflows/deploy.yml`) que publica o conteúdo do repositório na branch `gh-pages` automaticamente sempre que houver `push` na branch `main` ou quando você executar o workflow manualmente (botão "Run workflow" no GitHub).
 - Como usar (passos rápidos):
	 1. Crie um repositório no GitHub e faça commit/push de todo este projeto para a branch `main`.
	 2. No GitHub, acesse `Actions` → escolha o workflow `Deploy to GitHub Pages` e clique em `Run workflow` (ou apenas dê push na `main`).
	 3. Vá em `Settings` → `Pages` e configure a fonte para a branch `gh-pages` (pasta `/`). O site ficará disponível em `https://<seu-user>.github.io/<seu-repo>/`.

Observações:
 - O workflow usa o `GITHUB_TOKEN` padrão, então não é necessário criar secrets adicionais.
 - Se preferir que o deploy publique apenas um subdiretório (ex.: `dist/`), edite `publish_dir` no arquivo do workflow.

Autenticação e multi-usuário (próximos passos rápidos)
 - Recomendo usar Firebase Authentication + Firestore para obter autenticação pronta e persistência remota com o menor esforço.
 - Se quiser, eu posso: 1) adicionar a integração básica com Firebase Auth (login com email/password e botão), 2) migrar a persistência para Firestore e 3) proteger operações de escrita por regras do Firestore.
 - Diga se prefere que eu crie a integração Firebase agora (vou precisar que você crie um projeto Firebase e cole as credenciais de configuração), ou se prefere que eu crie um backend Node/Express em vez disso.
- Exportar CSV

Se quiser, eu implemento uma versão com backend (Node/Express) para salvar online, ou já subo para o GitHub Pages para você acessar pela web.