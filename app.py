from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return redirect(url_for('home'))
    return render_template('login.html')

@app.route('/home', methods=['GET', 'POST'])
def home():
    return render_template('home.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/busca')
def busca():
    return render_template('busca.html')

@app.route('/relatorios')
def relatorios():
    return render_template('relatorios.html')

@app.route('/performance')
def performance():
    return render_template('performance.html')

@app.route('/tramitacao')
def tramitacao():
    return render_template('tramitacao.html')

@app.route('/agenda')
def agenda():
    return render_template('agenda.html')

@app.route('/cadastro')
def cadastro():
    return render_template('cadastro.html')

@app.route('/importacao')
def importacao():
    return render_template('importacao.html')

@app.route('/recuperar_senha')
def recuperar_senha():
    return render_template('recuperar_senha.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
