import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# 1. Gerando dados fictícios mais realistas (50 amostras)
np.random.seed(42)  # Semente para o resultado ser igual em todas as execuções
metros = np.random.uniform(40, 150, 50)  # 50 imóveis variando de 40 a 150 m²

# Simulamos o preço: R$ 50 mil (base) + R$ 4.5k por metro + "ruído" aleatório
ruido = np.random.normal(0, 40, 50)
preco = 50 + (4.5 * metros) + ruido

df = pd.DataFrame({'Metros': metros, 'Preço': preco})

X = df[['Metros']]  # Variável independente (Matriz 2D exigida pelo sklearn)
y = df['Preço']    # Variável dependente (Vetor 1D)

# 2. Instanciando e Treinando o Modelo
modelo = LinearRegression()
modelo.fit(X, y)

# 3. Fazendo previsões e avaliando
previsoes = modelo.predict(X)

r2 = r2_score(y, previsoes)
# Raiz do Erro Quadrático Médio
rmse = np.sqrt(mean_squared_error(y, previsoes))

print("--- Avaliação do Modelo ---")
print(f"R²: {r2:.4f}")
print(f"RMSE: {rmse:.2f} mil reais (Margem média de erro)")
print(
    f"Equação: Preço = {modelo.intercept_:.2f} + {modelo.coef_[0]:.2f} * Metros\n")

# 4. Visualizando o Desempenho (Gráfico)
plt.figure(figsize=(9, 5))

# Plotando os dados reais (Pontos azuis)
plt.scatter(df['Metros'], df['Preço'], color='blue',
            alpha=0.6, label='Dados Reais')

# Plotando a reta do modelo (Reta vermelha)
plt.plot(df['Metros'], previsoes, color='red', linewidth=2,
         label='Previsão do Modelo (Reta OLS)')

# Formatando o gráfico para os alunos
plt.title('Regressão Linear: Preço vs. Metragem do Imóvel', fontsize=14)
plt.xlabel('Tamanho (Metros Quadrados)', fontsize=12)
plt.ylabel('Preço (Mil Reais)', fontsize=12)
plt.legend()
plt.grid(True, linestyle='--', alpha=0.5)

# Exibindo o gráfico
plt.show()
