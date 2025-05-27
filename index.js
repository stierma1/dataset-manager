require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
var file_system = require('fs');
var archiver = require('archiver');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Add middleware to parse JSON request bodies
app.use(express.json());

// Configure storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create dataset directory if it doesn't exist
        const datasetDir = 'public/datasets';
        fs.mkdir(datasetDir, { recursive: true }).then(() => {
            cb(null, datasetDir);
        }).catch(err => {
            cb(err);
        });
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        const timestamp = Date.now();
        cb(null, `${timestamp}_${basename}${ext}`);
    }
});

// Initialize multer middleware for handling multipart/form-data
const upload = multer({ storage: storage });

// Serve static files from the 'public' directory
app.use(express.static('public'));

// API Routes

// Create a new dataset
app.post('/api/datasets', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Dataset name is required' });
        }
        
        // Generate a unique dataset ID
        const datasetId = Date.now().toString();
        
        // Create the dataset directory structure
        await fs.mkdir(`public/datasets/${name}`, { recursive: true });
        await fs.mkdir(`public/datasets/${name}/images`, { recursive: true });
        await fs.mkdir(`public/datasets/${name}/videos`, { recursive: true });
        
        res.json({
            success: true,
            message: 'Dataset created successfully',
            dataset: {
                id: name,
                name
            }
        });
    } catch (error) {
        console.error('Error creating dataset:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Upload single file
app.post('/api/upload', upload.single('asset-file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Get asset type and create appropriate directory
        const assetType = req.body.asset_type || (req.file.mimetype.startsWith('image/') ? 'images' : 'videos');
        const datasetId = req.body.dataset_id || Date.now().toString();
        
        // Create dataset directories if they don't exist
        await fs.mkdir(`public/datasets/${datasetId}`, { recursive: true });
        await fs.mkdir(`public/datasets/${datasetId}/${assetType}`, { recursive: true });

        // Move file to appropriate directory
        const newFilePath = `public/datasets/${datasetId}/${assetType}/${req.file.filename}`;
        await fs.rename(req.file.path, newFilePath);

        // Create caption file if not provided
        let captionText = req.body.caption || '';
        
        // Generate caption with Ollama if requested
        if (req.body.generate_caption === 'true') {
            try {
                const ollamaResponse = await generateCaptionWithOllama(req.file.path);
                captionText = ollamaResponse;
            } catch (error) {
                console.error('Error generating caption:', error);
                // Continue even if caption generation fails
            }
        }
        
        // Create or update caption file
        const captionPath = `public/datasets/${datasetId}/${assetType}/${path.basename(req.file.filename, path.extname(req.file.filename))}.txt`;
        await fs.mkdir(`public/datasets/${datasetId}/${assetType}`, { recursive: true });
        await fs.writeFile(captionPath, captionText);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                name: req.file.originalname,
                path: newFilePath,
                type: assetType
            },
            caption: captionText
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get("/api/datasets/:id/:assetType/:assetName/generate/caption", async (req, res) => {
    let {id, assetType, assetName} = req.params;
    let assetPath = null;
    try {
        await fs.access(`public/datasets/${id}/${assetType}/${assetName}.jpg`)
        assetPath = `public/datasets/${id}/${assetType}/${assetName}.jpg`;
    }
    catch {

    }
    if(!assetPath){
        try {
            await fs.access(`public/datasets/${id}/${assetType}/${assetName}.png`)
            assetPath = `public/datasets/${id}/${assetType}/${assetName}.png`;
        }
        catch {

        }
    }
    if(!assetPath){
        try {
            await fs.access(`public/datasets/${id}/${assetType}/${assetName}.jpeg`)
            assetPath = `public/datasets/${id}/${assetType}/${assetName}.jpeg`;
        }
        catch {
            res.status(404).send();
            return;
        }
    }

    let caption = await generateCaptionWithOllama(assetPath);
    res.status(200).send(caption);
});

// Upload single file
app.put('/api/upload/caption', async (req, res) => {
    try {

        // Get asset type and create appropriate directory
        const assetType = req.body.asset_type || (req.file.mimetype.startsWith('image/') ? 'images' : 'videos');
        const datasetId = req.body.dataset_id || Date.now().toString();
        const assetName = req.body.asset_name;
        
        // Create dataset directories if they don't exist
        await fs.mkdir(`public/datasets/${datasetId}`, { recursive: true });
        await fs.mkdir(`public/datasets/${datasetId}/${assetType}`, { recursive: true });

        // Create caption file if not provided
        let captionText = req.body.caption || '';
        
        // Generate caption with Ollama if requested
        if (req.body.generate_caption === 'true') {
            try {
                //const ollamaResponse = await generateCaptionWithOllama(req.file.path);
                //captionText = ollamaResponse;
            } catch (error) {
                //console.error('Error generating caption:', error);
                // Continue even if caption generation fails
            }
        }
        
        // Create or update caption file
        const captionPath = `public/datasets/${datasetId}/${assetType}/${path.basename(assetName, path.extname(assetName))}.txt`;
        await fs.mkdir(`public/datasets/${datasetId}/${assetType}`, { recursive: true });
        await fs.writeFile(captionPath, captionText);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                name: assetName,
                path: captionPath.replace("public/", ""),
                type: assetType
            },
            caption: captionText
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Ollama Client Class
class OllamaClient {
    constructor() {
        if (!process.env.LLM_BASE_URL || !process.env.LLM_MODEL) {
            throw new Error('Ollama configuration missing - set LLM_BASE_URL and LLM_MODEL in .env');
        }
        
        this.baseUrl = process.env.LLM_BASE_URL;
        this.model = process.env.LLM_MODEL;
    }

    async generateWithOllama(prompt, imagePath) {
        const payload = {
            model: this.model,
            prompt: prompt,
            stream: false
        };

        if (imagePath) {
            const imageData = await fs.readFile(imagePath);
            payload.images = [imageData.toString('base64')];
        }

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            json:true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const result = await response.json();
        return result.response.trim();
    }
}

// Generate caption with Ollama
async function generateCaptionWithOllama(filePath) {
    const ollama = new OllamaClient();
    const assetType = path.extname(filePath).slice(1);
    
    const prompt = "Create a very detailed description of this scene. Do not use numbered lists or line breaks. IMPORTANT: The description should 1) describe the main content of the scene, 2) describe the environment and lighting details, 3) identify the type of shot (e.g., aerial shot, close-up, medium shot, long shot, view from below, view from above, POV, full body), and 4) include the atmosphere of the scene (e.g., cozy, tense, mysterious). Here's a template you MUST use: '{Primary Subject Action/Description}. {Environment and Lighting Details}. {Style and Technical Specifications}";

    return ollama.generateWithOllama(prompt, filePath);
}

// Get all datasets
app.get('/api/datasets', async (req, res) => {
    try {
        const datasetDir = 'public/datasets';
        
        // Check if datasets directory exists
        let exists = false;
        try {
            await fs.access(datasetDir);
            exists = true;
        } catch (error) {
            exists = false;
        }
        
        if (!exists) {
            return res.json({ success: true, datasets: [] });
        }

        // Read all dataset directories
        const datasetDirs = await fs.readdir(datasetDir);
        const datasets = [];

        for (const dir of datasetDirs) {
            try {
                const datasetPath = path.join(datasetDir, dir);
                
                // Check if it's a directory
                const stat = await fs.stat(datasetPath);
                if (!stat.isDirectory()) continue;

                // Get asset count
                let imageCount = 0;
                let videoCount = 0;
                
                try {
                    imageCount = (await fs.readdir(path.join(datasetPath, 'images'))).length/2;
                } catch (error) {
                    // images directory doesn't exist or can't be read
                }
                
                try {
                    videoCount = (await fs.readdir(path.join(datasetPath, 'videos'))).length/2;
                } catch (error) {
                    // videos directory doesn't exist or can't be read
                }

                datasets.push({
                    id: dir,
                    name: dir,
                    assetCount: imageCount + videoCount,
                    imageCount,
                    videoCount,
                    createdAt: new Date().toISOString()
                });
            } catch (error) {
                console.error(`Error processing dataset ${dir}:`, error);
                continue;
            }
        }

        res.json({ success: true, datasets });
    } catch (error) {
        console.error('Error getting datasets:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get dataset details
app.get('/api/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const datasetDir = path.join('public/datasets', id);
        
        // Check if dataset exists
        try {
            await fs.access(datasetDir);
        } catch (error) {
            return res.status(404).json({ success: false, message: 'Dataset not found' });
        }

        // Get asset details
        const assets = [];
        
        // Process images
        try {
            const imageFiles = await fs.readdir(path.join(datasetDir, 'images'));
            
            for (const file of imageFiles) {
                if (!file.endsWith('.txt')) {  // Skip caption files
                    const imagePath = path.join('datasets', id, 'images', file);
                    
                    assets.push({
                        id: `${id}_image_${path.basename(file)}`,
                        name: file,
                        type: 'images',
                        path: `datasets/${id}/images/${file}`,
                        captionPath: `datasets/${id}/images/${path.basename(file, path.extname(file))}.txt`
                    });
                }
            }
        } catch (error) {
            // images directory doesn't exist or can't be read
        }
        
        // Process videos
        try {
            const videoFiles = await fs.readdir(path.join(datasetDir, 'videos'));
            
            for (const file of videoFiles) {
                if (!file.endsWith('.txt')) {  // Skip caption files
                    const videoPath = path.join('datasets', id, 'videos', file);
                    
                    assets.push({
                        id: `${id}_video_${path.basename(file)}`,
                        name: file,
                        type: 'videos',
                        path: `datasets/${id}/videos/${file}`,
                        captionPath: `datasets/${id}/videos/${path.basename(file, path.extname(file))}.txt`
                    });
                }
            }
        } catch (error) {
            // videos directory doesn't exist or can't be read
        }

        res.json({
            success: true,
            dataset: {
                id,
                name: id,
                assets: assets.length,
                imageCount: assets.filter(a => a.type === 'images').length/2,
                videoCount: assets.filter(a => a.type === 'videos').length/2,
                createdAt: new Date().toISOString()
            },
            assets
        });
    } catch (error) {
        console.error('Error getting dataset:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Bundle dataset into ZIP file
app.post('/api/datasets/:id/bundle', async (req, res) => {
    try {
        const { id } = req.params;
        const datasetDir = path.join('public/datasets', id);
        
        // Check if dataset exists
        try {
            await fs.access(datasetDir);
        } catch (error) {
            return res.status(404).json({ success: false, message: 'Dataset not found' });
        }
        var archive = archiver('zip', { zlib: { level: 9 }});
        const zipFilePath = path.join(__dirname, `public/datasets/${id}`);

        // In a real implementation, we would use a library like archiver to create the ZIP file
        // For now, we'll simulate it
        archive.on('error', function(err){
            throw err;
        });
        
        // append files from a sub-directory, putting its contents at the root of archive
        archive.directory(zipFilePath, false);
        
        // append files from a sub-directory and naming it `new-subdir` within the archive
        archive.directory('images/', 'images');
        // append files from a sub-directory and naming it `new-subdir` within the archive
        archive.directory('videos/', 'videos');
        archive.finalize();
        archive.pipe(res);

    } catch (error) {
        console.error('Error bundling dataset:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});