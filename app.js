// ==========================================
// CONEXÃO COM O SUPABASE
// ==========================================

const SUPABASE_URL = "https://fyngtdtldltqbwfqbohy.supabase.co";
const SUPABASE_KEY = "sb_publishable_l_k9TLI3Nn4T3Bx5BuJpDw_PUc-GHqZ";

const banco = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ==========================================
// CONEXÃO COM A INTELIGÊNCIA ARTIFICIAL
// ==========================================

const IA_ENDPOINT =
    "https://fyngtdtldltqbwfqbohy.supabase.co/functions/v1/sabor-ia";

let historicoIA = [];
let iaOcupada = false;

// ==========================================
// ELEMENTOS DA PÁGINA
// ==========================================

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

const showMenuButton = document.getElementById("showMenuButton");
const showCartButton = document.getElementById("showCartButton");

// ==========================================
// DADOS DO SISTEMA
// ==========================================

let produtos = [];
let carrinho = [];
let quantidades = {};
let ultimoAvisoCarrinho = "";

let proximoItemId = 1;

const WHATSAPP = "5553984663646";

// ==========================================
// FORMATAÇÃO
// ==========================================

function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => {
        const entidades = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entidades[caractere];
    });
}

function normalizarTexto(texto) {
    return String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function rolarChat() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// MENSAGENS
// ==========================================

function adicionarMensagem(texto, tipo = "assistant") {
    const mensagem = document.createElement("div");

    mensagem.className = `message ${tipo}`;
    mensagem.textContent = texto;

    chatMessages.appendChild(mensagem);

    rolarChat();
}

// ==========================================
// INDICADOR DE RESPOSTA DA IA
// ==========================================

function mostrarDigitando() {
    removerDigitando();

    const indicador = document.createElement("div");

    indicador.id = "iaDigitando";
    indicador.className = "message assistant";
    indicador.textContent = "SaborIA está digitando...";

    chatMessages.appendChild(indicador);

    rolarChat();
}

function removerDigitando() {
    const indicador = document.getElementById("iaDigitando");

    if (indicador) {
        indicador.remove();
    }
}

// ==========================================
// CARREGAR PRODUTOS
// ==========================================

// Compartilha uma única consulta ao Supabase.
// Assim, duas funções podem aguardar o mesmo carregamento.

let promessaCarregamentoProdutos = null;

async function carregarProdutos(
    exibirCardapio = true,
    atualizar = false
) {

    // Se os produtos já estiverem carregados,
    // aproveitamos os dados que estão na memória.

    if (produtos.length > 0 && !atualizar) {
        if (exibirCardapio) {
            mostrarCardapio();
        }

        return true;
    }

    // Se já houver uma consulta em andamento,
    // aguardamos essa mesma consulta.

    if (!promessaCarregamentoProdutos) {
        promessaCarregamentoProdutos = (async () => {

            const { data, error } = await banco
                .from("produtos")
                .select("*")
                .eq("disponivel", true)
                .order("created_at", { ascending: true });

            if (error) {
                throw error;
            }

            produtos = data || [];

            return produtos.length > 0;

        })();
    }

    try {
        const encontrouProdutos =
            await promessaCarregamentoProdutos;

        if (exibirCardapio) {

            if (encontrouProdutos) {
                mostrarCardapio();

            } else {
                adicionarMensagem(
                    "Ainda não temos produtos disponíveis no cardápio."
                );
            }
        }

        return encontrouProdutos;

    } catch (error) {

        console.error(
            "Erro ao carregar produtos:",
            error
        );

        if (exibirCardapio) {
            adicionarMensagem(
                "Não consegui carregar o cardápio agora. Tente novamente."
            );
        }

        return false;

    } finally {
        promessaCarregamentoProdutos = null;
    }
}

// ==========================================
// CARDÁPIO
// ==========================================

function mostrarCardapio() {

    const anterior = document.getElementById("menuMessage");

    if (anterior) {
        anterior.remove();
    }

    const mensagem = document.createElement("div");

    mensagem.id = "menuMessage";
    mensagem.className = "message assistant message-menu";

    mensagem.innerHTML = `
        <p class="menu-title">Confira nosso cardápio 😋</p>
    `;

    const grade = document.createElement("div");

    grade.className = "menu-grid";

    produtos.forEach(produto => {

        const card = document.createElement("article");

        card.className = "product-card";

        const quantidade =
            quantidades[String(produto.id)] || 1;

        const imagem = produto.imagem_url
            ? `<img src="${escaparHTML(produto.imagem_url)}" alt="${escaparHTML(produto.nome)}">`
            : `<div class="product-placeholder">🍔</div>`;

        const disponibilidade =
            produto.tipo_controle === "sob_encomenda"
                ? "Preparado sob encomenda"
                : `Estoque: ${Number(produto.quantidade)}`;

        card.innerHTML = `
            ${imagem}

            <div class="product-info">

                <h3>${escaparHTML(produto.nome)}</h3>

                <p class="product-stock">
                    ${escaparHTML(disponibilidade)}
                </p>

                <p class="product-price">
                    ${formatarPreco(produto.preco)}
                </p>

                <div class="product-actions">

                    <div class="quantity-control">

                        <button
                            type="button"
                            data-action="diminuir"
                            data-id="${escaparHTML(produto.id)}"
                            aria-label="Diminuir quantidade"
                        >−</button>

                        <span id="quantidade-${escaparHTML(produto.id)}">
                            ${quantidade}
                        </span>

                        <button
                            type="button"
                            data-action="aumentar"
                            data-id="${escaparHTML(produto.id)}"
                            aria-label="Aumentar quantidade"
                        >+</button>

                    </div>

                    <button
                        type="button"
                        class="add-button"
                        data-action="adicionar"
                        data-id="${escaparHTML(produto.id)}"
                    >
                        Adicionar
                    </button>

                </div>

                <small
                    class="product-stock-warning"
                    id="aviso-${escaparHTML(produto.id)}"
                ></small>

            </div>
        `;

        grade.appendChild(card);
    });

    mensagem.appendChild(grade);

    chatMessages.appendChild(mensagem);

    atualizarBotoesPedido();

    rolarChat();
}

// ==========================================
// AVISOS E QUANTIDADES
// ==========================================

function atualizarQuantidadeVisual(id) {

    const contador =
        document.getElementById(`quantidade-${id}`);

    if (contador) {
        contador.textContent =
            quantidades[String(id)] || 1;
    }
}

function mostrarAvisoProduto(id, texto) {

    const aviso =
        document.getElementById(`aviso-${id}`);

    if (aviso) {
        aviso.textContent = texto;
    }
}

// ==========================================
// ESTOQUE DO CARRINHO
// ==========================================

function quantidadeNoCarrinho(produtoId) {

    return carrinho
        .filter(item =>
            String(item.id) === String(produtoId)
        )
        .reduce(
            (total, item) => total + item.quantidade,
            0
        );
}

// ==========================================
// ADICIONAR AO CARRINHO
// ==========================================

function adicionarAoCarrinho(
    produto,
    quantidade,
    observacao = ""
) {

    if (
        !produto ||
        !Number.isInteger(quantidade) ||
        quantidade < 1
    ) {
        return false;
    }

    const id = String(produto.id);

    const quantidadeAtual =
        quantidadeNoCarrinho(id);

    const novaQuantidade =
        quantidadeAtual + quantidade;

    // Verificar estoque

    if (produto.tipo_controle !== "sob_encomenda") {

        if (novaQuantidade > Number(produto.quantidade)) {

            ultimoAvisoCarrinho =
                `Estoque insuficiente para ${produto.nome}.`;

            atualizarBotoesPedido();

            mostrarAvisoProduto(
                id,
                "Quantidade maior que o estoque disponível."
            );

            return false;
        }
    }

    const nota = String(observacao || "")
        .trim()
        .slice(0, 200);

    // Verificar se o mesmo produto já existe
    // com a mesma observação.

    const itemExistente = carrinho.find(item =>
        String(item.id) === id &&
        normalizarTexto(item.observacao) ===
        normalizarTexto(nota)
    );

    if (itemExistente) {

        itemExistente.quantidade += quantidade;

    } else {

        carrinho.push({
            item_id: proximoItemId++,
            id: produto.id,
            nome: produto.nome,
            preco: Number(produto.preco),
            quantidade: quantidade,
            tipo_controle: produto.tipo_controle,
            observacao: nota
        });
    }

    ultimoAvisoCarrinho = "";

    mostrarAvisoProduto(id, "");

    atualizarBotoesPedido();

    return true;
}

// ==========================================
// PROCESSAR AÇÕES DA INTELIGÊNCIA ARTIFICIAL
// ==========================================

function processarAcoesIA(acoes) {

    const recusados = [];

    let quantidadeAdicionada = 0;

    if (!Array.isArray(acoes)) {
        return {
            recusados,
            quantidadeAdicionada
        };
    }

    acoes.forEach(acao => {

        if (!acao || acao.type !== "add_item") {
            return;
        }

        // Primeiro procura pelo ID.
        // Se não encontrar, procura pelo nome normalizado.

        const produto = produtos.find(item =>
            String(item.id) === String(acao.product_id)
        ) || produtos.find(item =>
            normalizarTexto(item.nome) ===
            normalizarTexto(acao.product_name)
        );

        if (!produto) {

            recusados.push(
                `Não encontrei "${acao.product_name}" no cardápio atual.`
            );

            return;
        }

        const quantidade = Number(acao.quantity);

        if (
            !Number.isInteger(quantidade) ||
            quantidade < 1 ||
            quantidade > 20
        ) {

            recusados.push(
                `Não consegui validar a quantidade de ${produto.nome}.`
            );

            return;
        }

        const observacao =
            typeof acao.note === "string"
                ? acao.note.trim()
                : "";

        const adicionou = adicionarAoCarrinho(
            produto,
            quantidade,
            observacao
        );

        if (adicionou) {

            quantidadeAdicionada += quantidade;

        } else {

            recusados.push(
                `Não consegui adicionar ${quantidade} unidade(s) de ${produto.nome} por causa do estoque disponível.`
            );
        }
    });

    return {
        recusados,
        quantidadeAdicionada
    };
}

// ==========================================
// CARRINHO COMPACTO
// ==========================================

function atualizarBotoesPedido() {

    let painel =
        document.getElementById("orderActions");

    if (carrinho.length === 0) {

        if (painel) {
            painel.remove();
        }

        return;
    }

    if (!painel) {

        painel = document.createElement("div");

        painel.id = "orderActions";
        painel.className = "cart-bar";

        chatMessages.appendChild(painel);
    }

    const quantidadeTotal = carrinho.reduce(
        (soma, item) => soma + item.quantidade,
        0
    );

    painel.innerHTML = `
        <div class="cart-bar-info">

            <div>
                <strong>🛒 Meu pedido</strong>

                <span>
                    ${quantidadeTotal}
                    ${quantidadeTotal === 1 ? "item" : "itens"}
                </span>
            </div>

            <strong class="cart-bar-total">
                ${formatarPreco(calcularTotal())}
            </strong>

        </div>

        ${ultimoAvisoCarrinho
            ? `<small class="cart-status">${escaparHTML(ultimoAvisoCarrinho)}</small>`
            : ""
        }

        <button
            type="button"
            class="cart-finish-button"
            data-order-action="concluir"
        >
            Finalizar pedido
        </button>
    `;
}

// ==========================================
// OPÇÕES DE FINALIZAÇÃO
// ==========================================

function mostrarOpcoesPedido() {

    if (carrinho.length === 0) {

        adicionarMensagem(
            "Seu carrinho ainda está vazio. Escolha alguns produtos primeiro."
        );

        return;
    }

    const anterior =
        document.getElementById("orderReady");

    if (anterior) {
        anterior.remove();
    }

    const mensagem = document.createElement("div");

    mensagem.id = "orderReady";
    mensagem.className = "message assistant order-ready";

    mensagem.innerHTML = `
        <strong>Seu pedido está pronto! 😋</strong>

        <p>Confira os itens antes de confirmar o envio.</p>

        <div class="order-ready-actions">

            <button
                type="button"
                data-order-action="revisar"
            >
                Revisar pedido
            </button>

            <button
                type="button"
                data-order-action="finalizar"
            >
                Confirmar e enviar pelo WhatsApp
            </button>

        </div>
    `;

    chatMessages.appendChild(mensagem);

    rolarChat();
}

// ==========================================
// REVISAR PEDIDO
// ==========================================

function mostrarCarrinho() {

    const anterior =
        document.getElementById("cartReview");

    if (anterior) {
        anterior.remove();
    }

    const mensagem = document.createElement("div");

    mensagem.id = "cartReview";
    mensagem.className = "message assistant cart-summary";

    mensagem.innerHTML = `
        <strong class="cart-review-title">🛒 Seu pedido</strong>
    `;

    if (carrinho.length === 0) {

        const vazio = document.createElement("p");

        vazio.className = "empty-cart";
        vazio.textContent = "Seu pedido ainda está vazio.";

        mensagem.appendChild(vazio);

    } else {

        const lista = document.createElement("div");

        lista.className = "cart-review-list";

        carrinho.forEach(item => {

            const linha = document.createElement("div");

            linha.className = "cart-item";

            linha.innerHTML = `
                <div class="cart-item-info">

                    <strong>${escaparHTML(item.nome)}</strong>

                    <span>
                        ${item.quantidade}x ${formatarPreco(item.preco)}
                    </span>

                    ${item.observacao
                        ? `<small class="cart-item-note">Observação: ${escaparHTML(item.observacao)}</small>`
                        : ""
                    }

                </div>

                <div class="cart-item-controls">

                    <button
                        type="button"
                        data-review-action="diminuir"
                        data-item-id="${item.item_id}"
                    >−</button>

                    <span>${item.quantidade}</span>

                    <button
                        type="button"
                        data-review-action="aumentar"
                        data-item-id="${item.item_id}"
                    >+</button>

                </div>

                <strong class="cart-item-subtotal">
                    ${formatarPreco(item.preco * item.quantidade)}
                </strong>
            `;

            lista.appendChild(linha);
        });

        mensagem.appendChild(lista);

        const total = document.createElement("div");

        total.className = "cart-total";

        total.innerHTML = `
            <span>Total</span>
            <strong>${formatarPreco(calcularTotal())}</strong>
        `;

        mensagem.appendChild(total);

        const botoes = document.createElement("div");

        botoes.className = "cart-review-actions";

        botoes.innerHTML = `
            <button
                type="button"
                data-order-action="editar"
            >
                Continuar comprando
            </button>

            <button
                type="button"
                data-order-action="finalizar"
            >
                Confirmar e enviar pelo WhatsApp
            </button>
        `;

        mensagem.appendChild(botoes);
    }

    chatMessages.appendChild(mensagem);

    rolarChat();
}

// ==========================================
// ALTERAR QUANTIDADE NA REVISÃO
// ==========================================

function alterarQuantidadeRevisao(itemId, acao) {

    const item = carrinho.find(
        produto =>
            String(produto.item_id) === String(itemId)
    );

    if (!item) return;

    const produto = produtos.find(
        produto =>
            String(produto.id) === String(item.id)
    );

    if (!produto) return;

    if (acao === "aumentar") {

        const quantidadeAtual =
            quantidadeNoCarrinho(item.id);

        if (produto.tipo_controle !== "sob_encomenda") {

            if (
                quantidadeAtual >= Number(produto.quantidade)
            ) {

                adicionarMensagem(
                    `Temos somente ${produto.quantidade} unidade(s) de ${produto.nome}.`
                );

                return;
            }
        }

        item.quantidade++;
    }

    if (acao === "diminuir") {

        item.quantidade--;

        if (item.quantidade <= 0) {

            carrinho = carrinho.filter(
                produto =>
                    produto.item_id !== item.item_id
            );
        }
    }

    atualizarBotoesPedido();

    mostrarCarrinho();
}

// ==========================================
// TOTAL DO CARRINHO
// ==========================================

function calcularTotal() {

    return carrinho.reduce(
        (soma, item) =>
            soma + item.preco * item.quantidade,
        0
    );
}

// ==========================================
// FINALIZAR PELO WHATSAPP
// ==========================================

function finalizarPedido() {

    if (carrinho.length === 0) {

        adicionarMensagem("Seu pedido está vazio.");

        return;
    }

    const total = calcularTotal();

    let mensagem =
        "Olá! Gostaria de confirmar este pedido:\n\n";

    carrinho.forEach(item => {

        mensagem +=
            `${item.quantidade}x ${item.nome} - ${formatarPreco(item.preco * item.quantidade)}\n`;

        if (item.observacao) {

            mensagem +=
                `   Observação: ${item.observacao}\n`;
        }
    });

    mensagem +=
        `\nTotal: ${formatarPreco(total)}`;

    const link =
        `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;

    window.open(link, "_blank");
}

// ==========================================
// CLIQUES NO CHAT
// ==========================================

chatMessages.addEventListener("click", event => {

    // ======================================
    // BOTÕES DOS PRODUTOS
    // ======================================

    const botaoProduto = event.target.closest(
        "button[data-action]"
    );

    if (botaoProduto) {

        const acao = botaoProduto.dataset.action;

        const id = String(
            botaoProduto.dataset.id
        );

        const produto = produtos.find(
            item => String(item.id) === id
        );

        if (!produto) return;

        const quantidadeAtual =
            quantidades[id] || 1;

        if (acao === "aumentar") {

            const limite =
                produto.tipo_controle === "sob_encomenda"
                    ? Infinity
                    : Number(produto.quantidade);

            if (quantidadeAtual >= limite) {

                mostrarAvisoProduto(
                    id,
                    `Disponível somente ${produto.quantidade} unidade(s).`
                );

                return;
            }

            quantidades[id] = quantidadeAtual + 1;
        }

        if (acao === "diminuir") {

            quantidades[id] = Math.max(
                1,
                quantidadeAtual - 1
            );
        }

        if (acao === "adicionar") {

            const adicionou = adicionarAoCarrinho(
                produto,
                quantidadeAtual
            );

            if (adicionou) {
                quantidades[id] = 1;
            }
        }

        atualizarQuantidadeVisual(id);

        return;
    }

    // ======================================
    // BOTÕES DO CARRINHO E FINALIZAÇÃO
    // ======================================

    const botaoPedido = event.target.closest(
        "[data-order-action]"
    );

    if (botaoPedido) {

        const acao =
            botaoPedido.dataset.orderAction;

        if (acao === "concluir") {
            mostrarOpcoesPedido();
        }

        if (acao === "revisar") {
            mostrarCarrinho();
        }

        if (acao === "finalizar") {
            finalizarPedido();
        }

        if (acao === "editar") {

            const revisao =
                document.getElementById("cartReview");

            if (revisao) {
                revisao.remove();
            }

            const opcoes =
                document.getElementById("orderReady");

            if (opcoes) {
                opcoes.remove();
            }

            const cardapio =
                document.getElementById("menuMessage");

            if (cardapio) {

                cardapio.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }

        return;
    }

    // ======================================
    // BOTÕES DE QUANTIDADE DA REVISÃO
    // ======================================

    const botaoRevisao = event.target.closest(
        "[data-review-action]"
    );

    if (botaoRevisao) {

        alterarQuantidadeRevisao(
            botaoRevisao.dataset.itemId,
            botaoRevisao.dataset.reviewAction
        );
    }
});

// ==========================================
// INTERPRETAR MENSAGEM DO CLIENTE
// ==========================================

function processarMensagem(texto) {

    const textoNormalizado =
        normalizarTexto(texto);

    // Comandos diretos do pedido

    if (
        textoNormalizado.includes("finalizar") ||
        textoNormalizado.includes("concluir") ||
        textoNormalizado.includes("fechar pedido") ||
        textoNormalizado.includes("pode fechar")
    ) {

        mostrarOpcoesPedido();

        return;
    }

    if (
        textoNormalizado.includes("revisar") ||
        textoNormalizado.includes("conferir pedido") ||
        textoNormalizado.includes("ver meu pedido")
    ) {

        mostrarCarrinho();

        return;
    }

    if (
        textoNormalizado.includes("cardapio") ||
        textoNormalizado.includes("menu")
    ) {

        carregarProdutos();

        return;
    }

    if (
        textoNormalizado === "pedido" ||
        textoNormalizado.includes("meu carrinho") ||
        textoNormalizado.includes("meu pedido")
    ) {

        mostrarCarrinho();

        return;
    }

    // Todas as demais mensagens vão para a IA.
    // Ela interpreta quantidades, produtos e observações.

    conversarComIA(texto);
}

// ==========================================
// INTELIGÊNCIA ARTIFICIAL
// ==========================================

async function conversarComIA(texto) {

    if (iaOcupada) {

        adicionarMensagem(
            "Só um instante! Estou terminando de responder sua mensagem anterior."
        );

        return;
    }

    iaOcupada = true;

    historicoIA.push({
        role: "user",
        content: texto
    });

    historicoIA = historicoIA.slice(-10);

    mostrarDigitando();

    try {

        // ======================================
        // CORREÇÃO DO CARREGAMENTO DOS PRODUTOS
        // ======================================

        // A IA consulta os produtos no servidor,
        // mas o carrinho é montado neste navegador.
        //
        // Por isso, precisamos carregar os produtos
        // antes de processar as ações retornadas pela IA.

        if (produtos.length === 0) {

            await carregarProdutos(false);
        }

        // ======================================
        // CONSULTAR A INTELIGÊNCIA ARTIFICIAL
        // ======================================

        const resposta = await fetch(IA_ENDPOINT, {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY
            },

            body: JSON.stringify({
                messages: historicoIA
            })
        });

        if (!resposta.ok) {

            const erro = await resposta.text();

            console.error(
                "Resposta da função:",
                erro
            );

            throw new Error(
                "Não foi possível consultar a inteligência artificial."
            );
        }

        const dados = await resposta.json();

        if (!dados.reply) {

            throw new Error(
                "A IA não retornou uma resposta válida."
            );
        }

        let textoResposta = dados.reply;

        let acoes = Array.isArray(dados.actions)
            ? dados.actions
            : [];

        // ======================================
        // COMPATIBILIDADE COM RESPOSTA EM JSON
        // ======================================

        if (typeof textoResposta === "string") {

            try {

                const textoLimpo = textoResposta
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/\s*```$/i, "")
                    .trim();

                const possivelJSON =
                    JSON.parse(textoLimpo);

                if (
                    possivelJSON &&
                    typeof possivelJSON === "object" &&
                    typeof possivelJSON.reply === "string"
                ) {

                    textoResposta =
                        possivelJSON.reply;

                    if (
                        Array.isArray(possivelJSON.actions) &&
                        acoes.length === 0
                    ) {

                        acoes = possivelJSON.actions;
                    }
                }

            } catch {

                // A resposta já era um texto normal.
            }
        }

        // ======================================
        // EXECUTAR AÇÕES DA IA
        // ======================================

        const resultadoAcoes =
            processarAcoesIA(acoes);

        // ======================================
        // VERIFICAR AÇÕES RECUSADAS
        // ======================================

        if (resultadoAcoes.recusados.length > 0) {

            textoResposta +=
                "\n\nAtenção: algumas quantidades não puderam ser adicionadas:\n" +
                resultadoAcoes.recusados.join("\n");
        }

        // ======================================
        // SALVAR HISTÓRICO
        // ======================================

        historicoIA.push({
            role: "assistant",
            content: textoResposta
        });

        historicoIA = historicoIA.slice(-10);

        // ======================================
        // MOSTRAR RESPOSTA
        // ======================================

        removerDigitando();

        adicionarMensagem(textoResposta);

    } catch (erro) {

        console.error("Erro na IA:", erro);

        removerDigitando();

        historicoIA.pop();

        adicionarMensagem(
            "Desculpe, estou com dificuldade para responder agora. Pode tentar novamente?"
        );

    } finally {

        iaOcupada = false;
    }
}

// ==========================================
// ENVIAR MENSAGEM
// ==========================================

chatForm.addEventListener("submit", event => {

    event.preventDefault();

    const texto = userInput.value.trim();

    if (!texto) return;

    if (iaOcupada) {

        adicionarMensagem(
            "Aguarde minha resposta anterior para enviar outra mensagem."
        );

        return;
    }

    adicionarMensagem(texto, "user");

    userInput.value = "";

    processarMensagem(texto);
});

// ==========================================
// BOTÕES RÁPIDOS
// ==========================================

showMenuButton.addEventListener("click", () => {

    carregarProdutos();

});

showCartButton.addEventListener("click", () => {

    mostrarCarrinho();

});
