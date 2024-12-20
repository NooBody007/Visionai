import os
from flask import Flask, render_template, request, redirect, url_for
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Set the folder for uploaded images
UPLOAD_FOLDER = 'static/uploads/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Make sure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/', methods=['GET', 'POST'])
def test():
    if request.method == 'POST':
        # Check if a file is uploaded
        if 'file' not in request.files:
            return redirect(request.url)
        
        file = request.files['file']
        
        # If the file is valid and has a filename, save it
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            return redirect(url_for('test'))
    
    # Get a list of all the uploaded images
    images = os.listdir(app.config['UPLOAD_FOLDER'])
    return render_template('test.html', images=images)

if __name__ == '__main__':
    app.run(debug=True)

"""
        <form class = "upload-button" method="POST" enctype="multipart/form-data">
            <input type="file" name="file" accept="image/*" required>
            <button type="submit">Upload</button>
        </form>



        {% for image in images %}
            <img src="{{ url_for('static', filename='uploads/' + image) }}" alt="{{ image }}">
        {% endfor %}
"""


