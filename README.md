# Farmácia São Marcos — Loja virtual

Landing page + e-commerce (React, Vite, Tailwind, Framer Motion e Lucide) com busca por texto e voz, checkout pelo WhatsApp com GPS e atualização do catálogo direto do sistema da farmácia (ERP).

Identidade visual da logo oficial: laranja `#F8832B` · índigo `#3A3A92` · branco e cinza `#F8FAFC`.

---

## 1. Atualizar o catálogo com a planilha "MANUTENÇÃO DE PRODUTOS"

### Passo a passo recomendado

```bash
# 1) coloque o .xlsx exportado do sistema na raiz do projeto (ou em ./data)

# 2) SIMULE primeiro: lê a planilha inteira, confere e gera o relatório, sem alterar o site
node scripts/import-catalog.mjs "MANUTENÇÃO DE PRODUTOS - 21-07-2026 112224.xlsx" --simular

# 3) confira o relatório em ./relatorios e, se estiver tudo certo, aplique de verdade
node scripts/import-catalog.mjs "MANUTENÇÃO DE PRODUTOS - 21-07-2026 112224.xlsx"

# 4) gere o site
npm run build
```

Também é possível fazer a atualização pelo navegador:

1. Na **linha azul do topo**, toque na **nuvem ☁️ ao lado do horário** (ou abra o site com `#admin` no fim do endereço).
2. Entre com o **login e a senha de administrador**.
3. Arraste a planilha (**.xlsx, .xls ou .csv**) e confira o relatório na tela.
4. Toque em **"Publicar no site para todos"**. O botão só aparece depois que a publicação on-line estiver conectada (ver "Publicação on-line" abaixo). Sem ela, use "Aplicar neste aparelho" para conferir, ou baixe o `catalog.json`.

Formatos aceitos, reconhecidos pelo conteúdo do arquivo:

- `.xlsx`;
- `.xls` do Excel 97-2003;
- `.xls` exportado em HTML ou em XML 2003, comum em sistemas de farmácia;
- `.csv` com `;`, `,` ou TAB, em UTF-8 ou Windows-1252.

> Códigos de barras em notação científica (ex.: `7,89741E+12`) são ignorados e o valor já cadastrado é mantido. No Excel, formate essa coluna como **Texto** antes de exportar.

### Acesso de administrador

- Há dois logins de administrador, `cleverton` e `saomarcos2026`.
- As senhas **não ficam no site**: `src/config/admins.ts` guarda só o hash PBKDF2-SHA256 de cada uma, com salt próprio.
- O login não diferencia maiúsculas de minúsculas.
- Após 5 tentativas erradas, o acesso é bloqueado por 1 minuto.
- A sessão dura 4 horas ou até a aba ser fechada.

Para criar um acesso ou trocar uma senha:

```bash
node scripts/admin-hash.mjs <login> "<nova senha>"   # gera a linha para colar em src/config/admins.ts
npm run build
```

> Com a publicação on-line conectada, o login passa a ser conferido pelo **servidor** (Supabase) e só os dois e-mails autorizados conseguem publicar. Sem ela, o login fica só no site e protege a tela de envio contra visitantes, mas o catálogo dos clientes não muda. Não reutilize essas senhas em outros serviços.

### Publicação on-line (Supabase, gratuito)

Configuração feita uma única vez, em cerca de 10 minutos. Depois disso, a planilha enviada pela nuvem ☁️ atualiza o site para **todos os clientes**, em até 1 minuto.

1. Crie uma conta em [supabase.com](https://supabase.com) (dá para entrar com o Google).
2. Clique em **New project**, dê o nome "farmacia-sao-marcos", escolha a região **São Paulo** e crie.
3. Abra **SQL Editor → New query**, cole o conteúdo de `supabase/setup.sql` e clique em **Run**.
4. Em **Authentication → Users → Add user → Create new user**, crie os dois acessos, sempre marcando **Auto Confirm User**:

   | E-mail | Senha |
   | --- | --- |
   | `cleverton@farmaciasaomarcos.app` | a mesma senha do login "cleverton" |
   | `saomarcos2026@farmaciasaomarcos.app` | a mesma senha do login "saomarcos2026" |

   Nenhum e-mail é enviado.
5. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**.
6. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**. Cole as duas em `src/config/publicacao.ts` (ou envie para quem cuida do site) e gere o site de novo com `npm run build`.

Como funciona:

- O catálogo publicado fica no arquivo público `catalogo/catalog.json`.
- Os visitantes carregam esse catálogo automaticamente, desde que ele seja mais novo que o do site.
- Se o servidor estiver fora do ar, o site continua mostrando o catálogo embutido.
- **Atenção:** no plano gratuito, o Supabase pausa projetos que ficam 7 dias sem uso. Se a publicação parar de funcionar, entre no painel e clique em **Restore project**.

### Regras de segurança aplicadas

| Situação | O que acontece |
| --- | --- |
| Produto já existe (mesmo **Código**) | É atualizado com os dados da planilha |
| Preço diferente | Recebe o novo **Preço Venda**, com os centavos preservados |
| Produto novo e ativo | É cadastrado |
| Produto que não consta na planilha | É **mantido** sem alteração (nada é excluído) |
| Produto desativado no sistema | É mantido no catálogo e aparece como "indisponível" |
| Mesmo código, mas código de barras e nome diferentes | Não é alterado; fica listado para conferência |
| Mesmo código de barras de outro produto com nome parecido | Não é cadastrado, para evitar duplicidade |
| Código duplicado na planilha | Mesclado se o preço for igual; se houver conflito de preços, não é importado e vai para o relatório |
| Linha sem código, sem nome ou sem preço | Não é importada e vai para o relatório |
| Promoção | Só quando a coluna **Preço Promoção** comprova (valor > 0 e menor que o Preço Venda) |
| Custo, markup, valor ST, preço de compra, fornecedor e comissão | São ignorados e nunca chegam ao site |
| Campo vazio na planilha (laboratório, EAN, fórmula…) | A informação que já existia é preservada |

Antes de gravar, o script faz um **backup** do catálogo anterior em `./relatorios`. O relatório final sai em Markdown e em JSON e traz:

- produtos analisados, atualizados e novos;
- preços alterados, com o valor anterior e o novo;
- produtos não identificados e com informações incompletas;
- códigos duplicados, erros e alertas.

> Os itens ilustrativos do protótipo (preços fictícios) são removidos automaticamente na primeira importação real. Nenhum produto real é excluído.

Outras opções do script:

- `--somente-estoque` → não cadastra produtos novos que estejam sem estoque.
- `--substituir` → recria o catálogo do zero.
- `--saida=` → muda o arquivo de saída do catálogo.
- `--relatorio=` → muda a pasta onde o relatório é salvo.

### Artes dos produtos

Todas as artes (cards, embalagens ilustradas, selos de oferta e banner "Esquenta Black") são geradas a partir de **um único padrão visual**. Na atualização mudam apenas os dados de cada produto: nome, preço e condição promocional. Nenhum elemento de design é alterado pela importação.

## 2. Configurar a loja

Edite `src/config/store.ts`:

- **WhatsApp oficial:** `558299269126`, que corresponde a +55 82 9926-9126.
- **Slogan:** "A farmácia de toda a família". Aparece no topo, na seção da família, no rodapé e no título da página.
- **Horários:** os mesmos dados alimentam o aviso "Aberto agora / Fechado", calculado no horário de Maceió.

  | Dia | Atendimento | Entregas |
  | --- | --- | --- |
  | Segunda a sábado | 7h às 22h | 8h às 21h30 |
  | Domingo | 8h às 12h e 17h às 21h | nos dois horários |

- **Pendentes:** endereço, CNPJ, farmacêutico responsável (CRF-AL), e-mail e Instagram. Enquanto vazios, ficam ocultos no site.

## PIX com QR Code (pagamento antecipado)

Os dados ficam em `src/config/pix.ts`: chave CNPJ **07.228.033/0001-32**, com o recebedor **Nadira Fernandes**.

1. Na forma de pagamento, o cliente escolhe **PIX** e vê o aviso de que o pedido é enviado após a confirmação do pagamento.
2. Depois de conferir o pedido, abre a etapa **"Pague com PIX"**. Ela traz:
   - o **QR Code** e o **Pix Copia e Cola** com o **valor exato** do pedido;
   - o nome do recebedor, para conferir no app do banco;
   - o identificador do pedido (ex.: `SM2611151034K7Q2`).
3. Depois de pagar, ele toca em **"Já paguei — enviar pedido"**. A mensagem do WhatsApp já sai com o bloco **"✅ PIX REALIZADO PELO CLIENTE"** (valor, identificador e recebedor).
4. A atendente só confere no banco se o PIX chegou e libera a entrega.

Detalhes técnicos:

- O código segue o padrão **BR Code (Pix estático)** do Banco Central e foi validado contra o exemplo oficial do manual.
- O dinheiro vai direto para a conta da chave. O site não intermedeia nem guarda dados de pagamento.
- O identificador do pedido também vai no código Pix. Alguns bancos o mostram no extrato de quem recebe.
- O campo "cidade" do QR Code está como `ALAGOAS`, porque os bancos não validam esse campo. Troque em `src/config/pix.ts` se quiser.

## 3. Campanha Black Friday

Edite `src/config/campanha.ts`. Cada item da lista é o **código do produto** no sistema com o **% de desconto**.

- O desconto é aplicado sobre o **Preço Venda** da planilha, com os centavos preservados.
- O limite é de 50%.
- A campanha termina sozinha na data `fim` (hoje, 30/11/2026).
- O título "ATÉ X% OFF" mostra sempre o maior desconto realmente aplicado.

> Os códigos atuais (300011–301011) são produtos **ilustrativos** e somem na primeira importação da planilha real. Troque-os pelos códigos reais antes de divulgar: o preço anunciado vale como oferta (CDC, art. 30).

## 4. Imagens

### Abertura da loja

Ao abrir ou atualizar o site, a logo oficial e o São Marquinhos aparecem em uma vinheta de aproximadamente cinco segundos. A loja é montada por trás da abertura, sem reinicializar o catálogo ou o carrinho ao terminar. A navegação interna não repete a vinheta.

**Pular abertura** ou **Esc** entra na loja antes do fim; **Pausar** suspende tanto os movimentos quanto o tempo da apresentação. Com a preferência de movimento reduzido do aparelho, a apresentação é estática e breve. As imagens e a fonte da assinatura estão incluídas no build; não há áudio nem vídeo externo. A duração é definida em `src/components/OpeningSequence.tsx`, e a composição e os movimentos em `src/components/opening-sequence.css`.

A logo e a foto da família ficam embutidas **como texto** em `src/assets/embedded.ts`. Assim não se perdem e não dependem de servidores externos.

Para trocar uma imagem:

1. Substitua o arquivo em `src/assets` (`logo-farmacia-sao-marcos.png` ou `familia-sao-marcos.jpg`).
2. Rode `node scripts/embed-assets.mjs`.
3. Se trocou a logo, rode também `node scripts/generate-icons.mjs`.
4. Rode `npm run build`.

### Ícone do atalho na tela inicial

Os ícones são montados com os **pixels da logo oficial**, na versão empilhada (cruz em cima e "SÃO MARCOS" embaixo, como na camisa do mascote). O nome que aparece embaixo do ícone é **"São Marcos"**.

| Onde | Ícone |
| --- | --- |
| iPhone (Safari → Compartilhar → "Adicionar à Tela de Início") | 180×180, embutido no `index.html` |
| Android (Chrome → ⋮ → "Adicionar à tela inicial" / "Instalar app") | 192 e 512, mais a versão adaptável ("maskable") com a logo dentro da área segura, em `public/manifest.webmanifest` |
| Aba do navegador | só a cruz da logo |

Tudo é gravado como texto, sem arquivos de imagem soltos que possam se perder. Para regenerar: `node scripts/generate-icons.mjs`.

> Quem já tinha adicionado o atalho antes precisa removê-lo e adicionar de novo para ver o ícone novo.

## 5. Funcionalidades

### Acesso por sintomas e documentos

- Os cinco atalhos, as frases ditadas e a pesquisa por texto usam o mesmo índice de cuidados em `src/lib/care-search.ts`. Ele associa os produtos do catálogo carregado a grupos de navegação a partir do grupo ERP, nome, fórmula e marcação de uso contínuo. Não é um diagnóstico nem uma prescrição; as associações podem ser revistas pelo farmacêutico, sem alterar os preços ou as regras de venda.
- O botão de câmera abre um diálogo com captura traseira, galeria, prévia e seleção do tipo de documento. As fotos são redimensionadas no próprio navegador e só ficam no `localStorage` após **Salvar neste aparelho**. Em **Meus Cartões Salvos** é possível reutilizá-las ou excluí-las. Nada é publicado no catálogo ou no Supabase.
- Após a prévia, o botão verde compartilha o **arquivo JPEG da foto** pelo menu nativo do aparelho (`navigator.share`), com a mensagem correspondente quando suportada. O cliente escolhe **WhatsApp**, a **Farmácia São Marcos** e confirma o envio. Isso vale para câmera, galeria e cartões salvos. Cancelar mantém a foto na tela; o site não afirma que a farmácia a recebeu.
- Em navegadores sem compartilhamento de arquivos, ou se o compartilhamento falhar, a alternativa é explícita: **baixar a foto**, **abrir o WhatsApp da farmácia** e anexar o arquivo na conversa. O link `wa.me` abre somente a mensagem, nunca transporta a imagem. As fotos não são enviadas a um servidor nem salvas automaticamente.
- A faixa de loja fechada acompanha os horários de `src/config/store.ts` e informa o próximo período de **entrega**, incluindo o intervalo do domingo. O atendimento também tem ligação direta no botão **Ligar para a Farmácia**.

- **Busca inteligente** (`src/lib/search.ts`): autocompletar a partir de 2 letras, tolerância a erros de digitação e busca por nome, princípio ativo, marca, código ou EAN.
- **Busca por voz** (`src/hooks/useVoiceSearch.ts`): Web Speech API em pt-BR, com retorno falado.
- **Checkout WhatsApp** (`src/components/CheckoutModal.tsx`): GPS com link do Google Maps, preenchimento pelo CEP, pagamento em Dinheiro/Cartão/PIX e mensagem padronizada.
- **Acessibilidade**: controle do tamanho da letra, botões grandes, alto contraste e barra inferior no celular.
- **Render 3D** (`src/lib/image3d.ts`): pipeline pronto para DALL·E 3, Flux ou Gemini.

> Voz e GPS exigem o site publicado em **https://**.
