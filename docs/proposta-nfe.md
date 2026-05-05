# Proposta: Emissão de Notas Fiscais no Sistema CampoSul

**Data:** Maio de 2026  
**Elaborado por:** Equipe de Desenvolvimento  
**Destinatário:** Proprietária — CampoSul

---

## 1. O que o sistema emite hoje

O sistema CampoSul já gera **recibos e documentos internos em PDF** para cada venda. Esses documentos têm validade interna — servem para controle do estabelecimento, mas **não têm valor fiscal perante a Receita Federal e a SEFAZ-PR (Secretaria da Fazenda do Paraná)**.

Ou seja: o cliente recebe um comprovante, mas não uma Nota Fiscal Eletrônica de verdade.

---

## 2. O que é uma NF-e real

Uma **Nota Fiscal Eletrônica (NF-e)** é um documento oficial, transmitido em tempo real para o servidor da SEFAZ do estado. Ela:

- Tem uma **chave de acesso de 44 dígitos** que qualquer pessoa pode consultar em `nfe.fazenda.gov.br`
- Fica armazenada nos servidores do governo
- É obrigatória na maioria das operações comerciais com outras empresas
- Tem validade jurídica e fiscal

Existem dois tipos que se aplicam ao caso da CampoSul:

| Tipo | Quando usar |
|------|-------------|
| **NF-e** | Venda para outra empresa, fazenda, CNPJ |
| **NFC-e** | Venda direta ao consumidor (balcão / PDV) |

---

## 3. O que é necessário antes de começar (fora do sistema)

Esses itens são exigências legais — independente do sistema escolhido:

1. **Certificado Digital e-CNPJ (A1)** — documento eletrônico que identifica a empresa junto ao governo. Custo: R$ 200–400/ano. Válido por 1 a 3 anos.
2. **Habilitação junto à SEFAZ-PR** — cadastro para autorizar a empresa a emitir NF-e. Feito pelo contador, sem custo.
3. **Contador configurando os impostos** — ICMS, CFOP (código de operação fiscal), CSOSN (Simples Nacional) ou CST, e NCM de cada produto. Sem isso o sistema não consegue preencher o XML corretamente.
4. **CNPJ ativo com regime tributário definido** — Simples Nacional, Lucro Presumido etc.

> **Resumo:** O sistema é apenas a ferramenta. As obrigações legais precisam estar em ordem primeiro, com apoio de um contador.

---

## 4. Como o sistema emitiria a NF-e — as opções

### Opção A — Integração com API especializada ✅ *Recomendada*

Existem empresas especializadas em NF-e que oferecem uma "ponte" entre o sistema e a SEFAZ. O sistema CampoSul envia os dados da venda, a API cuida de tudo (montar o XML, assinar com o certificado, transmitir, processar retorno) e devolve a nota autorizada.

**Vantagens:**
- Implementação muito mais rápida (semanas, não meses)
- A empresa da API mantém o sistema atualizado conforme mudanças do governo
- Suporte dedicado para problemas com SEFAZ
- Modo de contingência automático (quando SEFAZ cai, emite offline e sincroniza depois)

**Desvantagens:**
- Custo mensal

---

### Opção B — Implementação própria ❌ *Não recomendada*

Desenvolver diretamente o código que monta o XML, assina com o certificado e se comunica com a SEFAZ.

**Vantagens:**
- Sem custo de API

**Desvantagens:**
- Estimativa de 3 a 6 meses de desenvolvimento adicional
- Altíssima complexidade técnica (o manual da NF-e tem mais de 800 páginas)
- A cada atualização do governo, o sistema precisa ser atualizado manualmente
- Risco de rejeição das notas por erro de XML — impacto direto no negócio

> **Conclusão:** A Opção B não é economicamente viável para uma operação de pequeno porte. O custo de horas de desenvolvimento supera em muito o custo de uma API.

---

## 5. Fornecedor confirmado: Focus NF-e

**Site:** `focusnfe.com.br` — uma das APIs mais utilizadas no Brasil, com ampla adoção e boa reputação entre desenvolvedores.

### Plano avaliado: Retail (NFC-e)

| Item | Detalhe |
|------|---------|
| Preço | **R$ 59,90 / mês** |
| CNPJ inclusos | 1 |
| Pacote base | 500 NFC-e + 100 NF-e por mês |
| NFC-e excedente | R$ 0,05 por nota |
| NF-e excedente | R$ 0,15 por nota |
| Período de testes | 30 dias gratuitos (ambiente de homologação) |

**Observação importante:** o plano inclui CFe S@T e CFe MFe, que são modalidades específicas de SP e CE respectivamente. Para o Paraná esses itens não se aplicam — o que importa para a CampoSul são a **NFC-e** (PDV/balcão) e a **NF-e** (vendas para CNPJ).

### Avaliação do plano para a CampoSul

- 500 NFC-e/mês ≈ 16 vendas/dia no balcão — adequado para o porte atual
- 100 NF-e/mês ≈ 3 notas para CNPJ por dia — mais que suficiente para uma agropecuária
- Excedente barato: R$ 0,05/NFC-e significa que mesmo dobrando o volume, o custo adicional é baixo
- 30 dias de testes sem custo é o período certo para integrar e validar sem risco

---

## 6. Análise do volume: quantas notas por mês?

Essa é a pergunta-chave para confirmar se o plano Retail é suficiente.

**Exemplo prático para estimar:**
- 10 vendas no balcão por dia = ~220 NFC-e/mês ✅ dentro do pacote
- 3 vendas para fazendas/CNPJ por semana = ~12 NF-e/mês ✅ dentro do pacote
- Total estimado: ~232 documentos/mês — bem dentro das 600 do pacote

> Se o volume for maior que o esperado, o excedente é previsível e barato (R$ 0,05 por NFC-e adicional).

---

## 7. O que precisa mudar no sistema para suportar NF-e real

O sistema atual já tem a estrutura de vendas completa. As principais adições necessárias são:

### No cadastro de produto
| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **NCM** | Nomenclatura Comum do Mercosul — código fiscal do produto | `3101.00.00` (adubo) |
| **CSOSN** | Situação tributária no Simples Nacional | `400` (sem débito de ICMS) |
| **CFOP** | Código de operação — venda no balcão PR | `5102` |

### Na configuração da empresa
- Regime tributário (Simples Nacional = CRT 1)
- IE (Inscrição Estadual) — já temos no `.env`

### No fluxo de venda
- Ao finalizar a venda, o sistema chama a API da Focus com os dados da nota
- A Focus transmite para a SEFAZ-PR e retorna a chave de autorização
- O PDF gerado passa a ser o DANFE (Documento Auxiliar da NF-e) oficial

> **O que não muda:** a tela do PDV, o carrinho, o controle de estoque e os relatórios continuam exatamente como estão.

---

## 8. Etapas de implementação

Após a decisão, o processo seria:

1. **Contador** configura SEFAZ-PR, define CFOP e NCM dos produtos (~1 semana)
2. **Empresa** adquire certificado digital e-CNPJ A1 (~3–5 dias úteis)
3. **Desenvolvimento** integra a API Focus NF-e no sistema (~2–3 semanas)
4. **Homologação** — 30 dias de testes gratuitos da Focus para validar notas contra a SEFAZ sem valor real (~1 semana)
5. **Produção** — ativação em ambiente real com acompanhamento (~1 semana)

**Estimativa total: 5 a 7 semanas do início ao fim**, com a parte de sistema levando de 2 a 3 semanas.

---

## 9. Custos resumidos

| Item | Custo | Frequência |
|------|-------|------------|
| Certificado digital e-CNPJ A1 | R$ 200–400 | A cada 1–3 anos |
| Focus NF-e — Plano Retail | **R$ 59,90** | Mensal |
| NFC-e excedente (acima de 500) | R$ 0,05/nota | Por uso |
| NF-e excedente (acima de 100) | R$ 0,15/nota | Por uso |
| Desenvolvimento (integração) | A combinar | Único |

**Custo operacional mínimo após certificado:** R$ 59,90/mês.

---

## 10. Perguntas para decidir na reunião

- [ ] Qual é o regime tributário? (Simples Nacional, Lucro Presumido?) — define os códigos CSOSN/CST
- [ ] A empresa já tem Certificado Digital e-CNPJ A1 ativo?
- [ ] O contador pode levantar o NCM dos principais produtos?
- [ ] Qual é o volume médio de vendas por dia no balcão?
- [ ] Existem vendas frequentes para CNPJ/fazendas que precisem de NF-e?
- [ ] Fechar o plano Retail da Focus NF-e a R$ 59,90/mês?

---

*Documento elaborado para apoiar a decisão de negócio. Valores do plano Retail confirmados em maio/2026 — consultar o site oficial para eventuais atualizações.*
