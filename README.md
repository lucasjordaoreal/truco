# 🃏 Truco Paulista Web (Multiplayer P2P & Bots)

Jogo completo de **Truco Paulista** desenvolvido em HTML5, CSS3 puro e JavaScript ES6 moderno, 100% estático e compatível diretamente com o **GitHub Pages** (sem backend, sem banco de dados).

## 🚀 Como Jogar ou Hospedar no GitHub Pages

### 1. Hospedar no GitHub Pages
1. Crie um repositório no seu GitHub (ex: `truco-paulista`).
2. Envie os arquivos desta pasta para a branch principal (`main`).
3. No GitHub, vá em **Settings** > **Pages** > em **Branch** selecione `main` (pasta `/root`) e clique em **Save**.
4. Seu jogo estará no ar no endereço `https://seu-usuario.github.io/truco-paulista/`.

### 2. Jogar com Amigos
- **Criar Sala**: Clique em "Criar Sala Multiplayer", defina a quantidade de jogadores (**2, 4 ou 6**), senha (opcional) e marque se deseja preencher vagas vazias com Bots.
- **Convidar**: Basta clicar no botão do código da sala no topo para copiar o link direto (`#sala=XYZ`). Ao abrir o link, seu amigo já entra na mesa automaticamente!
- **Entrar em Sala**: Basta digitar o código de 5 letras fornecido pelo criador da mesa e a senha (se houver).

### 3. Jogar Solo contra Bots
- Clique em **"Jogar Solo com Bots"** para iniciar instantaneamente sem esperar ninguém.

---

## 📜 Regras Oficiais do Truco Paulista Implementadas

1. **Baralho**: 40 cartas (sem 8, 9, 10 e coringas). 3 cartas para cada jogador.
2. **Força das Cartas Comuns**:
   `4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3`
3. **A Vira e as Manilhas**:
   A manilha é a carta imediatamente superior à vira:
   - 4 ➔ 5 | 5 ➔ 6 | 6 ➔ 7 | 7 ➔ Q | Q ➔ J | J ➔ K | K ➔ A | A ➔ 2 | 2 ➔ 3 | 3 ➔ 4
   - **Força dos Naipes das Manilhas**:
     ♣️ **Paus (Zap)** > ♥️ **Copas (Copeta)** > ♠️ **Espadas (Espadilha)** > ♦️ **Ouros (Picafumo / Mole)**
4. **Desempate nas Vasas (Canga)**:
   - Empate na 1ª vasa: quem levar a 2ª ganha a mão.
   - Empate na 2ª vasa: quem venceu a 1ª ganha a mão.
   - Empate na 3ª vasa: quem venceu a 1ª ganha a mão.
   - Empate em todas as 3 vasas: vence a equipe do "mão" (quem abriu a rodada).
5. **Apostas**:
   - Normal (1 ponto) ➔ Truco (3) ➔ Seis (6) ➔ Nove (9) ➔ Doze (12).
   - Somente a equipe desafiada pode aceitar, correr ou aumentar.
6. **Encobrir Carta**:
   - Permitido a partir da 2ª vasa (jogar carta virada de valor 0 para blefe ou economia).
7. **Mão de Onze e Mão de Ferro**:
   - **Mão de Onze**: Quando uma equipe atinge 11 pontos, seus jogadores olham suas cartas antes de decidir jogar (vale 3) ou fugir (adversário leva 1). Truco proibido.
   - **Mão de Ferro**: No empate de 11 x 11, todas as cartas são jogadas às cegas (face down). Quem vencer a mão ganha a partida.
