const SUPABASE_URL = "https://fyngtdtldltqbwfqbohy.supabase.co";
const SUPABASE_KEY = "sb_publishable_l_k9TLI3Nn4T3Bx5BuJpDw_PUc-GHqZ";

const banco = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginScreen = document.getElementById("loginScreen");
const adminApp = document.getElementById("adminApp");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = document.getElementById("loginButton");

const productForm = document.getElementById("productForm");
const productFormCard = document.getElementById("productFormCard");
const productMessage = document.getElementById("productMessage");
const saveProductButton = document.getElementById("saveProductButton");

const productsList = document.getElementById("productsList");
const recentProducts = document.getElementById("recentProducts");
const productSearch = document.getElementById("productSearch");
const productCount = document.getElementById("productCount");

const quantityField = document.getElementById("quantityField");

let usuarioAtual = null;
let produtos = [];
let imagemAtual = null;
let imagemTemporaria = null;

// Elementos do formulário
const campos = {
    id: document.getElementById("productId"),
    nome: document.getElementById("productName"),
    categoria: document.getElementById("productCategory"),
    descricao: document.getElementById("productDescription"),
    preco: document.getElementById("productPrice"),
    quantidade: document.getElementById("productQuantity"),
    tipoControle: document.getElementById("productControlType"),
    imagem: document.getElementById("productImage"),
    disponivel: document.getElementById("productAvailable"),
    preview: document.getElementById("imagePreview")
};

// Mensagens
function mostrarMensagem(elemento, mensagem, sucesso = false) {
    elemento.textContent = mensagem;
    elemento.style.color = sucesso ? "#55c58b" : "#ed7777";
}

function limparMensagem(elemento) {
    elemento.textContent = "";
}

// Protege os textos cadastrados antes de colocá-los no HTML
function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// Controla a exibição do campo de quantidade
function atualizarCampoQuantidade() {
    const controlaEstoque = campos.tipoControle.value === "estoque";

    quantityField.classList.toggle("hidden", !controlaEstoque);

    campos.quantidade.required = controlaEstoque;
    campos.quantidade.disabled = !controlaEstoque;

    if (!controlaEstoque) {
        campos.quantidade.value = "0";
    } else if (campos.quantidade.value === "") {
        campos.quantidade.value = "0";
    }
}

campos.tipoControle.addEventListener("change", atualizarCampoQuantidade);

// Verifica se a conta está cadastrada como administradora
async function verificarAdministrador(usuario) {
    const { data, error } = await banco
        .from("admin_users")
        .select("user_id")
        .eq("user_id", usuario.id)
        .maybeSingle();

    if (error) {
        console.error("Erro ao verificar administrador:", error);
        return false;
    }

    return Boolean(data);
}

// Mostra o painel depois de confirmar a permissão
async function abrirPainel(usuario) {
    const autorizado = await verificarAdministrador(usuario);

    if (!autorizado) {
        await banco.auth.signOut();
        loginScreen.classList.remove("hidden");
        adminApp.classList.add("hidden");

        mostrarMensagem(
            loginMessage,
            "Esta conta não possui permissão de administrador."
        );

        return;
    }

    usuarioAtual = usuario;

    loginScreen.classList.add("hidden");
    adminApp.classList.remove("hidden");

    document.getElementById("adminEmail").textContent =
        usuario.email || "Administrador";

    await carregarProdutos();
}

// Login
loginForm.addEventListener("submit", async evento => {
    evento.preventDefault();

    limparMensagem(loginMessage);
    loginButton.disabled = true;
    loginButton.textContent = "Entrando...";

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("password").value;

    const { data, error } = await banco.auth.signInWithPassword({
        email,
        password: senha
    });

    if (error) {
        mostrarMensagem(loginMessage, "E-mail ou senha incorretos.");
        loginButton.disabled = false;
        loginButton.textContent = "Entrar no painel";
        return;
    }

    await abrirPainel(data.user);

    loginButton.disabled = false;
    loginButton.textContent = "Entrar no painel";
});

// Logout
document.getElementById("logoutButton").addEventListener("click", async () => {
    await banco.auth.signOut();

    usuarioAtual = null;
    produtos = [];

    adminApp.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginForm.reset();

    limparMensagem(loginMessage);
});

// Navegação entre as telas
function mostrarSecao(secao) {
    const dashboard = document.getElementById("dashboardSection");
    const produtosSection = document.getElementById("productsSection");

    dashboard.classList.toggle("hidden", secao !== "dashboard");
    produtosSection.classList.toggle("hidden", secao !== "products");

    document.getElementById("pageTitle").textContent =
        secao === "dashboard" ? "Visão geral" : "Produtos";

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.section === secao
        );
    });

    if (secao === "products") {
        renderizarProdutos();
    }
}

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", evento => {
        evento.preventDefault();
        mostrarSecao(link.dataset.section);
    });
});

document.querySelectorAll("[data-open-products]").forEach(botao => {
    botao.addEventListener("click", () => {
        mostrarSecao("products");
        abrirFormulario();
    });
});

document.getElementById("newProductButton").addEventListener("click", () => {
    abrirFormulario();
});

document.getElementById("cancelFormButton").addEventListener("click", fecharFormulario);
document.getElementById("cancelFormButtonBottom").addEventListener("click", fecharFormulario);

// Abre o formulário para cadastrar um produto
function abrirFormulario() {
    productForm.reset();

    campos.id.value = "";
    campos.quantidade.value = "0";
    campos.tipoControle.value = "estoque";
    campos.disponivel.checked = true;

    atualizarCampoQuantidade();

    imagemAtual = null;

    campos.preview.src = "";
    campos.preview.classList.add("hidden");

    document.getElementById("formTitle").textContent = "Novo produto";
    saveProductButton.textContent = "Salvar produto";

    limparMensagem(productMessage);

    productFormCard.classList.remove("hidden");

    productFormCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function fecharFormulario() {
    productFormCard.classList.add("hidden");
    productForm.reset();

    campos.tipoControle.value = "estoque";
    atualizarCampoQuantidade();

    imagemAtual = null;
    campos.preview.src = "";
    campos.preview.classList.add("hidden");

    limparMensagem(productMessage);
}

// Prévia da imagem escolhida
campos.imagem.addEventListener("change", () => {
    const arquivo = campos.imagem.files[0];

    if (imagemTemporaria) {
        URL.revokeObjectURL(imagemTemporaria);
        imagemTemporaria = null;
    }

    if (!arquivo) {
        if (imagemAtual) {
            campos.preview.src = imagemAtual;
            campos.preview.classList.remove("hidden");
        } else {
            campos.preview.classList.add("hidden");
        }
        return;
    }

    const formatosPermitidos = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!formatosPermitidos.includes(arquivo.type)) {
        mostrarMensagem(productMessage, "Formato de imagem não permitido.");
        campos.imagem.value = "";
        return;
    }

    if (arquivo.size > 2 * 1024 * 1024) {
        mostrarMensagem(productMessage, "A imagem deve ter no máximo 2 MB.");
        campos.imagem.value = "";
        return;
    }

    imagemTemporaria = URL.createObjectURL(arquivo);
    campos.preview.src = imagemTemporaria;
    campos.preview.classList.remove("hidden");

    limparMensagem(productMessage);
});

// Envia uma imagem para o Supabase Storage
async function enviarImagem(arquivo) {
    if (!usuarioAtual) {
        throw new Error("Você precisa estar conectado.");
    }

    const extensao = arquivo.name.split(".").pop().toLowerCase();
    const nomeArquivo = `${usuarioAtual.id}/${crypto.randomUUID()}.${extensao}`;

    const { error } = await banco.storage
        .from("produtos")
        .upload(nomeArquivo, arquivo, {
            contentType: arquivo.type,
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data } = banco.storage
        .from("produtos")
        .getPublicUrl(nomeArquivo);

    return data.publicUrl;
}

// Cadastra ou atualiza um produto
productForm.addEventListener("submit", async evento => {
    evento.preventDefault();

    limparMensagem(productMessage);

    saveProductButton.disabled = true;
    saveProductButton.textContent = "Salvando...";

    try {
        const id = campos.id.value;

        const preco = Number(campos.preco.value);
        const tipoControle = campos.tipoControle.value;

        let quantidade = 0;

        if (!Number.isFinite(preco) || preco <= 0) {
            throw new Error("Informe um preço válido.");
        }

        if (!["estoque", "sob_encomenda"].includes(tipoControle)) {
            throw new Error("Selecione um tipo de controle válido.");
        }

        if (tipoControle === "estoque") {
            quantidade = Number(campos.quantidade.value);

            if (!Number.isInteger(quantidade) || quantidade < 0) {
                throw new Error("Informe uma quantidade válida.");
            }
        }

        let imagemUrl = imagemAtual;

        const arquivo = campos.imagem.files[0];

        if (arquivo) {
            if (arquivo.size > 2 * 1024 * 1024) {
                throw new Error("A imagem deve ter no máximo 2 MB.");
            }

            imagemUrl = await enviarImagem(arquivo);
        }

        const produto = {
            nome: campos.nome.value.trim(),
            categoria: campos.categoria.value.trim(),
            descricao: campos.descricao.value.trim(),
            preco,
            quantidade,
            tipo_controle: tipoControle,
            imagem_url: imagemUrl,
            disponivel: campos.disponivel.checked
        };

        if (!produto.nome || !produto.categoria) {
            throw new Error("Preencha o nome e a categoria.");
        }

        if (id) {
            const { error } = await banco
                .from("produtos")
                .update(produto)
                .eq("id", id);

            if (error) throw error;

            mostrarMensagem(
                productMessage,
                "Produto atualizado com sucesso!",
                true
            );
        } else {
            const { error } = await banco
                .from("produtos")
                .insert(produto);

            if (error) throw error;

            mostrarMensagem(
                productMessage,
                "Produto cadastrado com sucesso!",
                true
            );
        }

        await carregarProdutos();

        setTimeout(() => {
            fecharFormulario();
            mostrarSecao("products");
        }, 700);

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);

        mostrarMensagem(
            productMessage,
            erro.message || "Não foi possível salvar o produto."
        );
    } finally {
        saveProductButton.disabled = false;
        saveProductButton.textContent = campos.id.value
            ? "Salvar alterações"
            : "Salvar produto";
    }
});

// Busca todos os produtos no banco
async function carregarProdutos() {
    productsList.innerHTML = '<div class="empty-state">Carregando produtos...</div>';

    const { data, error } = await banco
        .from("produtos")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar produtos:", error);
        productsList.innerHTML =
            '<div class="empty-state">Não foi possível carregar os produtos. Verifique as permissões do banco.</div>';
        return;
    }

    produtos = data || [];

    atualizarIndicadores();
    renderizarProdutos();
    renderizarRecentes();
}

// Atualiza os números do dashboard
function atualizarIndicadores() {
    const disponiveis = produtos.filter(produto => produto.disponivel);
    const indisponiveis = produtos.filter(produto => !produto.disponivel);

    document.getElementById("totalProducts").textContent = produtos.length;
    document.getElementById("availableProducts").textContent = disponiveis.length;
    document.getElementById("unavailableProducts").textContent = indisponiveis.length;
}

// Cria o HTML de um produto
function criarCardProduto(produto) {
    const id = escaparHTML(produto.id);
    const nome = escaparHTML(produto.nome);
    const categoria = escaparHTML(produto.categoria);
    const imagem = escaparHTML(produto.imagem_url || "");
    const preco = formatarPreco(produto.preco);

    const tipoControle = produto.tipo_controle || "estoque";

    const informacaoEstoque = tipoControle === "sob_encomenda"
        ? "Sob encomenda"
        : `Estoque: ${Number(produto.quantidade)} unidades`;

    const status = produto.disponivel
        ? '<span class="availability yes">Disponível</span>'
        : '<span class="availability no">Indisponível</span>';

    const foto = imagem
        ? `<img class="product-thumb" src="${imagem}" alt="${nome}">`
        : '<div class="product-thumb"></div>';

    return `
        <article class="product-row">
            ${foto}

            <div class="product-info">
                <h3>${nome}</h3>
                <p>${categoria} · ${informacaoEstoque}</p>
                ${status}
            </div>

            <strong class="product-price">${preco}</strong>

            <div class="product-actions">
                <button class="small-button" data-edit="${id}">Editar</button>
                <button class="small-button delete" data-delete="${id}">Excluir</button>
            </div>
        </article>
    `;
}

// Renderiza a lista de produtos
function renderizarProdutos() {
    if (!productsList) return;

    const termo = productSearch.value.trim().toLowerCase();

    const filtrados = produtos.filter(produto => {
        return (
            produto.nome.toLowerCase().includes(termo) ||
            produto.categoria.toLowerCase().includes(termo)
        );
    });

    productCount.textContent =
        `${filtrados.length} ${filtrados.length === 1 ? "produto" : "produtos"}`;

    if (filtrados.length === 0) {
        productsList.innerHTML =
            '<div class="empty-state">Nenhum produto encontrado. Cadastre seu primeiro produto!</div>';
        return;
    }

    productsList.innerHTML = filtrados.map(criarCardProduto).join("");
}

// Renderiza os produtos recentes na visão geral
function renderizarRecentes() {
    const recentes = produtos.slice(0, 4);

    if (recentes.length === 0) {
        recentProducts.innerHTML =
            '<div class="empty-state">Você ainda não cadastrou produtos.</div>';
        return;
    }

    recentProducts.innerHTML = recentes.map(criarCardProduto).join("");
}

// Abre o formulário preenchido para editar
async function editarProduto(id) {
    const produto = produtos.find(item => item.id === id);

    if (!produto) return;

    productForm.reset();

    campos.id.value = produto.id;
    campos.nome.value = produto.nome;
    campos.categoria.value = produto.categoria;
    campos.descricao.value = produto.descricao || "";
    campos.preco.value = produto.preco;
    campos.quantidade.value = produto.quantidade ?? 0;
    campos.tipoControle.value = produto.tipo_controle || "estoque";
    campos.disponivel.checked = produto.disponivel;

    atualizarCampoQuantidade();

    campos.imagem.value = "";

    imagemAtual = produto.imagem_url || null;

    if (imagemAtual) {
        campos.preview.src = imagemAtual;
        campos.preview.classList.remove("hidden");
    } else {
        campos.preview.classList.add("hidden");
    }

    document.getElementById("formTitle").textContent = "Editar produto";
    saveProductButton.textContent = "Salvar alterações";

    limparMensagem(productMessage);

    productFormCard.classList.remove("hidden");

    productFormCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// Exclui um produto
async function excluirProduto(id) {
    const produto = produtos.find(item => item.id === id);

    if (!produto) return;

    const confirmar = confirm(
        `Tem certeza que deseja excluir "${produto.nome}"?`
    );

    if (!confirmar) return;

    const { error } = await banco
        .from("produtos")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Erro ao excluir:", error);
        alert("Não foi possível excluir o produto.");
        return;
    }

    await carregarProdutos();
    alert("Produto excluído com sucesso!");
}

// Eventos dos botões de edição e exclusão
document.addEventListener("click", evento => {
    const botaoEditar = evento.target.closest("[data-edit]");
    const botaoExcluir = evento.target.closest("[data-delete]");

    if (botaoEditar) {
        editarProduto(botaoEditar.dataset.edit);
    }

    if (botaoExcluir) {
        excluirProduto(botaoExcluir.dataset.delete);
    }
});

// Busca de produtos
productSearch.addEventListener("input", renderizarProdutos);

// Verifica se já existe uma sessão salva
async function iniciarSistema() {
    const { data, error } = await banco.auth.getSession();

    if (error) {
        console.error("Erro ao verificar sessão:", error);
        return;
    }

    if (data.session) {
        await abrirPainel(data.session.user);
    }
}

atualizarCampoQuantidade();
iniciarSistema();