const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

// Middleware
app.use(cors());
app.use(express.json());

// Função auxiliar para garantir que o diretório de dados e o ficheiro db.json existam
async function initializeDb() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.access(DB_PATH);
    } catch (error) {
        // Se o ficheiro não existir, cria-o com uma estrutura inicial
        if (error.code === "ENOENT") {
            console.log("db.json não encontrado. A criar um novo com estrutura vazia.");
            await fs.writeFile(DB_PATH, JSON.stringify({ properties: [] }, null, 2), "utf-8");
        } else {
            throw error; // Propaga outros erros
        }
    }
}

// Função auxiliar para ler dados do db.json
async function readData() {
    await initializeDb(); // Garante que o ficheiro existe
    const data = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(data);
}

// Função auxiliar para escrever dados no db.json
async function writeData(data) {
    await initializeDb(); // Garante que o diretório existe
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// Validação básica para um novo imóvel (pode ser expandida)
function validateProperty(property) {
    const requiredFields = ["title", "address", "bedrooms", "bathrooms", "suites", "built_area", "total_area", "price", "condition", "description", "cover_image_url", "photos_google_drive_link"];
    for (const field of requiredFields) {
        if (!property[field] && property[field] !== 0) { // Permite 0 para campos numéricos
            return `O campo '${field}' é obrigatório.`;
        }
    }
    if (typeof property.bedrooms !== "number" || typeof property.bathrooms !== "number" || typeof property.suites !== "number" || typeof property.built_area !== "number" || typeof property.total_area !== "number") {
        return "Campos de quartos, banheiros, suítes e áreas devem ser números.";
    }
    return null; // Sem erros de validação
}

// Rotas da API

// GET /api/imoveis - Listar todos os imóveis
app.get("/api/imoveis", async (req, res) => {
    try {
        const data = await readData();
        res.json(data.properties || []);
    } catch (error) {
        console.error("Erro em GET /api/imoveis:", error);
        res.status(500).json({ message: "Erro ao ler os dados dos imóveis." });
    }
});

// POST /api/imoveis - Adicionar um novo imóvel
app.post("/api/imoveis", async (req, res) => {
    try {
        const newProperty = req.body;
        const validationError = validateProperty(newProperty);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const data = await readData();
        newProperty.id = Date.now().toString();
        if (!data.properties) {
            data.properties = [];
        }
        data.properties.push(newProperty);
        await writeData(data);
        res.status(201).json(newProperty);
    } catch (error) {
        console.error("Erro em POST /api/imoveis:", error);
        res.status(500).json({ message: "Erro ao adicionar o imóvel." });
    }
});

// PUT /api/imoveis/:id - Atualizar um imóvel existente
app.put("/api/imoveis/:id", async (req, res) => {
    try {
        const propertyId = req.params.id;
        const updatedPropertyData = req.body;

        // Validação para os dados atualizados (pode ser mais específica)
        const validationError = validateProperty(updatedPropertyData);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const data = await readData();
        const propertyIndex = data.properties.findIndex(p => p.id === propertyId);

        if (propertyIndex === -1) {
            return res.status(404).json({ message: "Imóvel não encontrado." });
        }

        data.properties[propertyIndex] = { ...data.properties[propertyIndex], ...updatedPropertyData, id: propertyId };
        await writeData(data);
        res.json(data.properties[propertyIndex]);
    } catch (error) {
        console.error(`Erro em PUT /api/imoveis/${req.params.id}:`, error);
        res.status(500).json({ message: "Erro ao atualizar o imóvel." });
    }
});

// DELETE /api/imoveis/:id - Apagar um imóvel
app.delete("/api/imoveis/:id", async (req, res) => {
    try {
        const propertyId = req.params.id;
        const data = await readData();
        const initialLength = data.properties.length;
        data.properties = data.properties.filter(p => p.id !== propertyId);

        if (data.properties.length === initialLength) {
            return res.status(404).json({ message: "Imóvel não encontrado para apagar." });
        }

        await writeData(data);
        res.status(200).json({ message: "Imóvel apagado com sucesso." });
    } catch (error) {
        console.error(`Erro em DELETE /api/imoveis/${req.params.id}:`, error);
        res.status(500).json({ message: "Erro ao apagar o imóvel." });
    }
});

// Iniciar o servidor
app.listen(PORT, async () => {
    await initializeDb(); // Garante que db.json existe antes de aceitar conexões
    console.log(`Servidor backend a rodar na porta ${PORT}`);
    console.log(`Ficheiro de dados em: ${DB_PATH}`);
});

