# Lora Dataset Manager

This application provides a user interface for managing datasets used in Lora training. It allows users to create, view, and manage datasets containing images and videos.

## Features

- List all available datasets
- Create new datasets
- View dataset details including assets (images and videos)
- Upload individual assets to datasets
- Upload folders of assets (planned feature)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/lora-dataset-manager.git
   cd lora-dataset-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node index.js
   ```

4. Open your browser and navigate to http://localhost:3000

## Usage

### Creating a Dataset
1. Click the "Create New Dataset" button on the main page
2. Enter a name for your dataset
3. Click "Create Dataset"

### Viewing Datasets
- Click on any dataset in the list to view its details and assets

### Adding Assets
1. In the dataset view, click the "Upload Assets" button
2. Select an individual file or folder to upload
3. Optionally add a caption for the asset
4. Click "Upload Asset"

## API Endpoints

The backend provides several API endpoints:

- `GET /api/datasets` - List all datasets
- `POST /api/datasets` - Create a new dataset
- `GET /api/datasets/:id` - Get details about a specific dataset
- `POST /api/upload` - Upload an asset to a dataset

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
