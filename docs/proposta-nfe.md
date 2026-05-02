# Proposta: Emissão de Notas Fiscais no Sistema CampoSul

**Data:** Maio de 2026  
**Elaborado por:** Equipe de Desenvolvimento  
**Destinatário:** Proprietária — CampoSul

---

## 1. O que o sistema emite hoje

O sistema CampoSul já gera **recibos e documentos internos em PDF** para cada venda. Esses documentos têm validade interna — servem para controle do estabelecimento, mas **não têm valor fiscal perante a Receita Federal e a SEFAZ (Secretaria da Fazenda do RS)**.

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

1. **Certificado Digital e-CNPJ** — documento eletrônico que identifica a empresa junto ao governo. Custo: R$ 200–400/ano. Válido por 1 a 3 anos.
2. **Habilitação junto à SEFAZ-RS** — cadastro para autorizar a empresa a emitir NF-e. Feito pelo contador, sem custo.
3. **Contador configurando os impostos** — ICMS, CFOP (código de operação fiscal), CST, NCM dos produtos. Sem isso o sistema não consegue preencher o XML corretamente.
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

## 5. Comparativo das principais APIs disponíveis

### 5.1 Focus NF-e — `focusnfe.com.br`

Uma das APIs mais utilizadas no Brasil. Funciona com NF-e, NFC-e e NFS-e.

**Planos (valores aproximados, consultar site para valores atuais):**

| Plano | Documentos/mês | Preço estimado |
|-------|----------------|----------------|
| Starter | 50 docs | ~R$ 79/mês |
| Básico | 150 docs | ~R$ 149/mês |
| Profissional | 500 docs | ~R$ 299/mês |
| Enterprise | Ilimitado | Sob consulta |

**Importante sobre os limites de documentos:**
- O limite não é um bloqueio. Se emitir além do plano, cada nota extra é cobrada individualmente (em torno de R$ 0,40–0,80 por nota).
- Dá para estimar o custo com base no volume real de vendas.
- Não há risco de "travar" a operação por ter ultrapassado o plano.

**Avaliação:**
- Interface de gestão clara
- Boa documentação técnica
- Suporte via chat e e-mail
- Amplamente testado por desenvolvedores brasileiros

---

### 5.2 Nuvem Fiscal — `nuvemfiscal.com.br`

API mais moderna, com interface REST (mais fácil de integrar). Também suporta NF-e, NFC-e e NFS-e.

**Planos (valores aproximados):**

| Plano | Documentos/mês | Preço estimado |
|-------|----------------|----------------|
| Grátis | 50 docs | R$ 0 |
| Starter | 200 docs | ~R$ 89/mês |
| Profissional | 1.000 docs | ~R$ 199/mês |
| Escala | Ilimitado | Sob consulta |

**Importante:**
- O plano **gratuito com 50 notas/mês** pode ser suficiente para começar
- Notas excedentes também são cobradas por unidade
- API mais moderna e bem documentada

**Avaliação:**
- Excelente documentação
- Plano gratuito viabiliza testes sem custo
- Suporte técnico disponível
- Empresa mais nova, porém com boa reputação crescente

---

## 6. Análise do volume: quantas notas por mês?

Essa é a pergunta-chave para escolher o plano certo.

**Perguntas para estimar:**

1. Quantas vendas para outras empresas (CNPJ) acontecem por mês? → precisam de NF-e
2. Quantas vendas diretas ao consumidor no balcão acontecem por dia? → precisam de NFC-e
3. Existe entrega de mercadoria que exige nota de transporte?

**Exemplo prático:**
- 2 vendas para fazendas por semana = ~8 NF-e/mês
- 10 vendas no balcão por dia = ~220 NFC-e/mês
- Total: ~228 documentos/mês → plano de 200 docs com pequeno excedente

> Se o volume for abaixo de 50 documentos/mês, o **plano gratuito da Nuvem Fiscal é suficiente para começar sem nenhum custo de API**.

---

## 7. Recomendação

### Cenário 1: Volume baixo (até 50 notas/mês)
**Nuvem Fiscal — Plano Gratuito**
- Custo: R$ 0/mês de API
- Custo total adicional: apenas o certificado digital (~R$ 400/ano = R$ 33/mês)
- Ideal para começar e validar o processo

### Cenário 2: Volume médio (50–200 notas/mês)
**Nuvem Fiscal — Plano Starter (~R$ 89/mês)**
- Custo total: ~R$ 89 + ~R$ 33 = ~R$ 122/mês
- Cobre a grande maioria das operações de pequeno porte

### Cenário 3: Volume alto (acima de 200 notas/mês)
**Focus NF-e — Plano Profissional (~R$ 299/mês) ou Nuvem Fiscal escalonado**
- A partir desse volume, o custo por nota extra começa a pesar
- Vale avaliar planos anuais com desconto

---

## 8. Etapas de implementação

Após a decisão, o processo seria:

1. **Contador** configura SEFAZ, define CFOP e NCM dos produtos (~1 semana)
2. **Empresa** adquire certificado digital e-CNPJ (~3–5 dias úteis)
3. **Desenvolvimento** integra a API escolhida no sistema (~2–3 semanas)
4. **Ambiente de homologação** — SEFAZ disponibiliza ambiente de testes. Emitimos notas "de mentira" para validar tudo antes de ir a produção (~1 semana)
5. **Produção** — ativação em ambiente real com acompanhamento (~1 semana)

**Estimativa total: 5 a 7 semanas do início ao fim**, com a parte de sistema levando de 2 a 3 semanas.

---

## 9. Custos resumidos

| Item | Custo | Frequência |
|------|-------|------------|
| Certificado digital e-CNPJ | R$ 200–400 | A cada 1–3 anos |
| API Nuvem Fiscal (plano grátis) | R$ 0 | Mensal |
| API Nuvem Fiscal (plano starter) | ~R$ 89 | Mensal |
| API Focus NF-e (plano básico) | ~R$ 149 | Mensal |
| Desenvolvimento (integração) | A combinar | Único |

---

## 10. Perguntas para decidir

Para avançar, precisamos responder:

- [ ] O estabelecimento já tem CNPJ e contador ativo?
- [ ] Qual é o volume aproximado de vendas que precisariam de nota fiscal por mês?
- [ ] As vendas são mais para outras empresas (NF-e) ou para consumidor final (NFC-e)?
- [ ] Há urgência — existe fiscalização iminente ou cliente exigindo nota já?
- [ ] A empresa prefere começar com plano gratuito e migrar conforme crescer?

---

*Documento elaborado para apoiar a decisão de negócio. Valores de planos são estimativas — consultar os sites oficiais para valores atualizados.*
