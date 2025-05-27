// DOM Elements
const datasetList = document.getElementById('dataset-list');
const noDatasetsMessage = document.getElementById('no-datasets-message');
const createDatasetBtn = document.getElementById('create-dataset-btn');
const createModal = document.getElementById('create-modal');
const uploadModal = document.getElementById('upload-modal');
const closeButtons = document.querySelectorAll('.close-btn');
const createDatasetForm = document.getElementById('create-dataset-form');
const uploadAssetForm = document.getElementById('upload-asset-form');
const toast = document.getElementById('toast');

// Current dataset ID for asset uploads
let currentDatasetId = null;

// Helper function to get filename without extension
function getFilenameWithoutExtension(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}

//Zip Assets
async function zipAssets(datasetId){
    const response = await fetch(`/api/datasets/${datasetId}/bundle`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
          },
        body: JSON.stringify({
            id:datasetId
        })
    });
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = datasetId + '.zip'; // Set the desired filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url); // Clean up the URL object
}

// Show modal
function showModal(modal) {
    modal.classList.remove('hidden');
}

// Hide modal
function hideModal(modal) {
    modal.classList.add('hidden');
}

// Show toast notification
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = 'toast';
    
    if (isError) {
        toast.classList.add('error');
    }
    
    // Make sure the toast is visible
    toast.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Fetch datasets from API
async function fetchDatasets() {
    try {
        const response = await fetch('/api/datasets');
        if (!response.ok) throw new Error('Failed to fetch datasets');
        
        const data = await response.json();
        
        // Clear the dataset list
        while (datasetList.firstChild && datasetList.firstChild !== noDatasetsMessage) {
            datasetList.removeChild(datasetList.firstChild);
        }
        
        // Show or hide the "no datasets" message
        if (data.datasets.length === 0) {
            noDatasetsMessage.style.display = 'block';
        } else {
            noDatasetsMessage.style.display = 'none';
            
            // Add each dataset to the list
            data.datasets.forEach(dataset => {
                const datasetItem = document.createElement('div');
                datasetItem.className = 'dataset-item';
                datasetItem.dataset.id = dataset.id;
                
                datasetItem.innerHTML = `
                    <h3 class="dataset-name">${dataset.name}</h3>
                    <div class="asset-count">
                        <span>${dataset.assetCount} total assets</span>
                        <span>${dataset.imageCount} images, ${dataset.videoCount} videos</span>
                    </div>
                `;
                
                // Add click event to navigate to dataset view
                datasetItem.addEventListener('click', () => {
                    showDatasetView(dataset.id);
                });
                
                datasetList.appendChild(datasetItem);
            });
        }
    } catch (error) {
        console.error('Error fetching datasets:', error);
        showToast('Failed to load datasets. Please try again.', true);
    }
}

// Show dataset view
async function showDatasetView(datasetId) {
    // Save the current dataset ID for asset uploads
    currentDatasetId = datasetId;
    
    // Fetch dataset details and assets
    try {
        const response = await fetch(`/api/datasets/${datasetId}`);
        if (!response.ok) throw new Error('Failed to fetch dataset');
        
        const data = await response.json();
        
        // Create view page content
        const datasetView = document.createElement('div');
        datasetView.className = 'dataset-view';
        datasetView.id = `view-${datasetId}`;
        datasetView.style.display = 'block'
        
        // Add header with back button and upload button
        const header = document.createElement('div');
        header.className = 'dataset-header';
        header.innerHTML = `
            <button class="back-btn" id="back-to-list">← Back to List</button>
            <h2>${data.dataset.name}</h2>
            <button id="zip-assets-btn">Zip Assets</button>
            <button id="upload-assets-btn">Upload Assets</button>
        `;
        
        // Add asset grid
        const assetGrid = document.createElement('div');
        assetGrid.className = 'asset-grid';
        
        // Populate asset grid with cards
        for (const asset of data.assets) {
            const card = document.createElement('div');
            card.className = 'asset-card';
            
            // Create preview element based on asset type
            let preview;
            if (asset.type === 'images') {
                preview = document.createElement('img');
                preview.src = `/datasets/${datasetId}/images/${asset.name}`;
                preview.className = 'asset-preview';
            } else if (asset.type === 'videos') {
                preview = document.createElement('video');
                preview.src = `/datasets/${datasetId}/videos/${asset.name}`;
                preview.className = 'asset-preview';
                preview.controls = true;
            }
            
            // Create caption element
            const captionContainer = document.createElement('div');
            captionContainer.className = 'asset-caption-container';
            
            // Fetch caption if it exists
            try {
                const captionResponse = await fetch(`/datasets/${datasetId}/${asset.type}/${getFilenameWithoutExtension(asset.name)}.txt`);
                let captionText = '';
                
                if (captionResponse.ok) {
                    captionText = await captionResponse.text();
                } else {
                    captionText = 'No caption available';
                }
                
                // Create editable caption
                const captionInput = document.createElement('textarea');
                captionInput.className = 'asset-caption-input';
                captionInput.value = captionText;
                captionInput.placeholder = 'Enter asset description...';
                
                // Create save button
                const saveButton = document.createElement('button');
                saveButton.className = 'save-caption-btn';
                saveButton.textContent = 'Save Caption';

                // Add event listener to save button
                saveButton.addEventListener('click', async () => {
                    try {
                        const response = await fetch(`/api/upload/caption`, {
                            method: 'PUT',
                            headers: {
                                "Content-Type": "application/json",
                              },
                            body: JSON.stringify({
                                asset_type: asset.type,
                                dataset_id: datasetId,
                                asset_name: asset.name,
                                caption: captionInput.value.trim()
                            })
                        });
                        
                        if (!response.ok) throw new Error('Failed to save caption');
                        
                        // Show success message
                        showToast(`Caption saved successfully!`);
                    } catch (error) {
                        console.error('Error saving caption:', error);
                        showToast('Failed to save caption. Please try again.', true);
                    }
                });

                // Create save button
                const generateCaption = document.createElement('button');
                generateCaption.className = 'save-caption-btn';
                generateCaption.textContent = 'Generate Caption';
                
                // Add event listener to save button
                generateCaption.addEventListener('click', async () => {
                    try {
                        const response = await fetch(`/api/datasets/${datasetId}/${asset.type}/${getFilenameWithoutExtension(asset.name)}/generate/caption`);
                        
                        if (!response.ok) throw new Error('Failed to save caption');
                        captionInput.value = await response.text();
                        // Show success message
                        showToast(`Caption generated successfully!`);
                    } catch (error) {
                        console.error('Error generating caption:', error);
                        showToast('Failed to generate caption. Please try again.', true);
                    }
                });
                
                // Add elements to the view
                captionContainer.appendChild(captionInput);
                captionContainer.appendChild(saveButton);
                captionContainer.appendChild(generateCaption);
            } catch (error) {
                console.error('Error fetching caption:', error);
                const captionInput = document.createElement('textarea');
                captionInput.className = 'asset-caption-input';
                captionInput.placeholder = 'Enter asset description...';
                
                // Create save button
                const saveButton = document.createElement('button');
                saveButton.className = 'save-caption-btn';
                saveButton.textContent = 'Save Caption';
                
                // Add event listener to save button
                saveButton.addEventListener('click', async () => {
                    try {
                        const response = await fetch(`/datasets/${datasetId}/${asset.type}/${getFilenameWithoutExtension(asset.name)}.txt`, {
                            method: 'PUT',
                            body: captionInput.value.trim()
                        });
                        
                        if (!response.ok) throw new Error('Failed to save caption');
                        
                        // Show success message
                        showToast(`Caption saved successfully!`);
                    } catch (error) {
                        console.error('Error saving caption:', error);
                        showToast('Failed to save caption. Please try again.', true);
                    }
                });

                // Create save button
                const generateCaption = document.createElement('button');
                generateCaption.className = 'save-caption-btn';
                generateCaption.textContent = 'Generate Caption';
                
                // Add event listener to save button
                generateCaption.addEventListener('click', async () => {
                    try {
                        const response = await fetch(`/api/datasets/${datasetId}/${asset.type}/${getFilenameWithoutExtension(asset.name)}/generate/caption`);
                        
                        if (!response.ok) throw new Error('Failed to generate caption');
                        captionInput.value = await response.text();
                        // Show success message
                        showToast(`Caption generated successfully!`);
                    } catch (error) {
                        console.error('Error generating caption:', error);
                        showToast('Failed to generate caption. Please try again.', true);
                    }
                });
                
                // Add elements to the view
                captionContainer.appendChild(captionInput);
                captionContainer.appendChild(saveButton);
                captionContainer.appendChild(generateCaption);
            }
            
            card.appendChild(preview);
            card.appendChild(captionContainer);
            assetGrid.appendChild(card);
        }
        
        // Add elements to the view
        datasetView.appendChild(header);
        datasetView.appendChild(assetGrid);
        
        // Replace main content with dataset view
        const mainContent = document.querySelector('main');
        if (document.getElementById(`view-${datasetId}`)) {
            document.getElementById(`view-${datasetId}`).replaceWith(datasetView);
        } else {
            mainContent.innerHTML = '';
            mainContent.appendChild(datasetView);
        }
        
        // Add event listener to back button
        document.getElementById('back-to-list').addEventListener('click', () => {
            datasetView.remove();
            fetchDatasets(); // Refresh the dataset list
        });
        
        // Add event listener to upload assets button
        document.getElementById('upload-assets-btn').addEventListener('click', () => {
            showModal(uploadModal);
        });
        document.getElementById('zip-assets-btn').addEventListener('click', () => {
            zipAssets(datasetId);
        });
    } catch (error) {
        console.error('Error showing dataset view:', error);
        showToast('Failed to load dataset details. Please try again.', true);
        
        // Return to list view on error
        const datasetItem = document.querySelector(`.dataset-item[data-id="${datasetId}"]`);
        if (datasetItem) {
            datasetItem.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Initialize the application
function init() {
    // Fetch datasets when the page loads
    fetchDatasets();
    
    // Add event listener to create dataset button
    createDatasetBtn.addEventListener('click', () => {
        showModal(createModal);
    });
    
    // Add event listeners to close buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            hideModal(modal);
        });
    });
    
    // Add event listener to create dataset form
    createDatasetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const datasetName = document.getElementById('dataset-name').value.trim();
        
        if (!datasetName) {
            showToast('Please enter a dataset name.', true);
            return;
        }
        
        try {
            // Send request to create dataset
            const response = await fetch('/api/datasets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: datasetName })
            });
            
            if (!response.ok) throw new Error('Failed to create dataset');
            
            // Get the created dataset ID
            const data = await response.json();
            
            // Hide modal and reset form
            hideModal(createModal);
            createDatasetForm.reset();
            
            // Show success message
            showToast(`Dataset "${datasetName}" created successfully!`);
            
            // Refresh datasets list
            fetchDatasets();
        } catch (error) {
            console.error('Error creating dataset:', error);
            showToast('Failed to create dataset. Please try again.', true);
        }
    });
    
    // Add event listener to upload asset form
    uploadAssetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentDatasetId) {
            showToast('No dataset selected for upload.', true);
            return;
        }
        
        const fileInput = document.getElementById('asset-file');
        const assetTypeSelect = document.getElementById('asset-type');
        const captionTextarea = document.getElementById('asset-caption');
        
        // Check if a file is selected
        if (!fileInput.files.length) {
            showToast('Please select a file to upload.', true);
            return;
        }
        
        try {
            // Create FormData object for the request
            const formData = new FormData();
            formData.append('asset-file', fileInput.files[0]);
            formData.append('dataset_id', currentDatasetId);
            formData.append('asset_type', assetTypeSelect.value);
            formData.append('caption', captionTextarea.value.trim());
            
            // Send request to upload asset
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to upload asset');
            
            // Get the uploaded asset details
            const data = await response.json();
            
            // Hide modal and reset form
            hideModal(uploadModal);
            uploadAssetForm.reset();
            
            // Show success message
            showToast(`Asset "${data.file.name}" uploaded successfully!`);
            
            // Refresh dataset view if it exists
            const datasetView = document.getElementById(`view-${currentDatasetId}`);
            if (datasetView) {
                showDatasetView(currentDatasetId);
            } else {
                fetchDatasets(); // Refresh the dataset list
            }
        } catch (error) {
            console.error('Error uploading asset:', error);
            showToast('Failed to upload asset. Please try again.', true);
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);