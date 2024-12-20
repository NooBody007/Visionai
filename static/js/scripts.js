// scripts.js

document.addEventListener('DOMContentLoaded', function () {
    const uploadForm = document.getElementById('uploadForm');
    const photoUpload = document.getElementById('photoUpload');
    const imageList = document.getElementById('imageList');
    const annotationsList = document.getElementById('annotationsList');
    const exportButton = document.getElementById('exportButton');
    const canvasElement = document.getElementById('imageCanvas');
    const canvas = new fabric.Canvas('imageCanvas', {
        selection: false
    });
    let currentImage = null;
    let currentImageName = '';
    let annotationCounter = 0;

    // Initialize: Load existing images
    fetchImages();

    // Handle image uploads
    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const files = photoUpload.files;
        if (files.length === 0) {
            alert('Please select image files to upload.');
            return;
        }

        const formData = new FormData();
        for (let file of files) {
            // Only append image files
            if (file.type.startsWith('image/')) {
                formData.append('photos', file);
            }
        }

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.uploaded_files) {
                fetchImages();
                alert('Upload successful!');
            } else if (data.error) {
                alert('Error: ' + data.error);
            }
        })
        .catch(err => {
            console.error('Upload error:', err);
            alert('An error occurred during upload.');
        });
    });

    // Fetch and display the list of images
    function fetchImages() {
        fetch('/images')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error fetching images: ' + data.error);
                    return;
                }
                imageList.innerHTML = '';
                data.images.forEach(image => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item list-group-item-action';
                    li.textContent = image;
                    li.style.cursor = 'pointer';
                    li.addEventListener('click', () => {
                        selectImage(image);
                    });
                    imageList.appendChild(li);
                });
            })
            .catch(err => {
                console.error('Error fetching images:', err);
                alert('An error occurred while fetching images.');
            });
    }

    // Select an image and display it on the canvas
    function selectImage(imageName) {
        currentImageName = imageName;
        const imageUrl = `/static/uploads/${imageName}`;
        fabric.Image.fromURL(imageUrl, function (img) {
            canvas.clear();
            img.set({
                selectable: false,
                evented: false
            });
            // Scale image to fit canvas
            const canvasWidth = canvas.getWidth();
            const canvasHeight = canvas.getHeight();
            const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
            img.scale(scale);
            canvas.add(img);
            currentImage = img;

            // Load existing annotations for this image
            loadAnnotations(imageName);
        }, { crossOrigin: 'anonymous' });
    }

    // Add rectangle on canvas
    canvas.on('mouse:down', function (options) {
        if (!currentImage) return;

        const pointer = canvas.getPointer(options.e);
        const rect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'rgba(255,0,0,0.3)',
            stroke: 'red',
            strokeWidth: 2,
            selectable: true
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        canvas.on('mouse:move', drawRectangle);
        canvas.on('mouse:up', finalizeRectangle);
    });

    function drawRectangle(options) {
        const pointer = canvas.getPointer(options.e);
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === 'rect') {
            activeObject.set({ width: pointer.x - activeObject.left, height: pointer.y - activeObject.top });
            canvas.renderAll();
        }
    }

    function finalizeRectangle(options) {
        canvas.off('mouse:move', drawRectangle);
        canvas.off('mouse:up', finalizeRectangle);

        const rect = canvas.getActiveObject();
        if (rect) {
            rect.setCoords();
            rect.lockMovementX = rect.lockMovementY = true;
            rect.hasControls = false;
            rect.on('selected', function () {
                // Handle selection if needed
            });

            // Assign an ID to the rectangle
            rect.set('id', 'rect_' + (++annotationCounter));

            // Prompt for label
            const label = prompt('Enter label for this rectangle:', 'Label');
            if (label === null) {
                // If canceled, remove the rectangle
                canvas.remove(rect);
                return;
            }
            rect.set('label', label);
            addAnnotationToList(rect);
            saveAnnotations();
        }
    }

    // Add annotation to the right sidebar
    function addAnnotationToList(rect) {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.id = rect.id;
        li.textContent = rect.label;

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-secondary';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            const newLabel = prompt('Edit label:', rect.label);
            if (newLabel !== null) {
                rect.set('label', newLabel);
                li.textContent = newLabel;
                li.appendChild(editBtn);
                canvas.renderAll();
                saveAnnotations();
            }
        });

        li.appendChild(editBtn);
        annotationsList.appendChild(li);
    }

    // Save annotations to the server
    function saveAnnotations() {
        const objects = canvas.getObjects('rect');
        const annots = objects.map(obj => ({
            id: obj.id,
            left: obj.left,
            top: obj.top,
            width: obj.width * obj.scaleX,
            height: obj.height * obj.scaleY,
            label: obj.label
        }));

        fetch('/annotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: currentImageName,
                annotations: annots
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'success') {
                alert('Failed to save annotations.');
            }
        })
        .catch(err => {
            console.error('Error saving annotations:', err);
        });
    }

    // Load annotations from the server
    function loadAnnotations(imageName) {
        fetch(`/annotations/${imageName}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error fetching annotations: ' + data.error);
                    return;
                }
                annotationsList.innerHTML = '';
                canvas.getObjects('rect').forEach(rect => canvas.remove(rect));
                data.annotations.forEach(annot => {
                    const rect = new fabric.Rect({
                        left: annot.left,
                        top: annot.top,
                        width: annot.width,
                        height: annot.height,
                        fill: 'rgba(0,0,255,0.3)',
                        stroke: 'blue',
                        strokeWidth: 2,
                        selectable: true,
                        hasControls: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        id: annot.id,
                        label: annot.label
                    });
                    canvas.add(rect);
                    addAnnotationToList(rect);
                });
                canvas.renderAll();
            })
            .catch(err => {
                console.error('Error loading annotations:', err);
                alert('An error occurred while loading annotations.');
            });
    }

    // Handle annotation list item clicks
    annotationsList.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON') return; // Ignore button clicks
        const li = e.target.closest('li');
        if (li) {
            const rect = canvas.getObjects('rect').find(r => r.id === li.id);
            if (rect) {
                canvas.setActiveObject(rect);
                canvas.renderAll();
            }
        }
    });

    // Export annotations
    exportButton.addEventListener('click', function () {
        window.location.href = '/export';
    });
});
