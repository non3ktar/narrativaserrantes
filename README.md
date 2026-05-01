# Narrativas Errantes v1.0 🎥✍️

**Narrativas Errantes** é um motor de narrativa mobile-first que transforma suas caminhadas em experiências cinematográficas literárias. Utilizando visão computacional (Canvas API), processamento de áudio e inteligência artificial (Speech-to-Text), o app aplica filtros estéticos e legendas dinâmicas em tempo real enquanto você narra sua história.

## 🚀 Tecnologias
- **Framework**: [Next.js 15+](https://nextjs.org/) (React 19)
- **Estilização**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animações**: [Framer Motion / Motion 12](https://motion.dev/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Vibe**: Cinema Noir, Cyberpunk, Mangá, Horror VHS e Experimental.

## ✨ Funcionalidades "UI Pro Max"
- **Filtros em Tempo Real**: Renderização via Canvas 2D com shaders de ruído, scanlines e vinheta.
- **Transcrição Dinâmica**: Uso da Web Speech API para gerar legendas que aparecem conforme você fala.
- **Ducking de Áudio**: A trilha sonora diminui automaticamente de volume quando o sistema detecta sua voz.
- **Mobile First**: Interface otimizada para uso em campo (Unidade de Campo).
- **Exportação Local**: Gravação direta no navegador gerando arquivos .webm de alta qualidade.

## 🛠️ Como Executar Localmente

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

3. **Acesse no Navegador**:
   Abra [http://localhost:3000](http://localhost:3000). 
   *Dica: Use o modo "Inspecionar" do Chrome e selecione um dispositivo móvel para a melhor experiência.*

## 📋 Changelog / Histórico de Modificações
- **v1.0.0 (Atual)**:
    - Implementação da lógica de reinicialização automática do Speech Recognition (correção de queda no mobile).
    - Refatoração do `stopAllMedia` com `useCallback` para evitar vazamentos de memória.
    - Otimização do loop de renderização do Canvas para suportar 1080p.
    - Adição de feedback de erro para permissões de câmera/microfone.
    - Implementação de limpeza de buffers no `useEffect` cleanup.

## 🎨 Atmosferas Disponíveis
- **Noir**: Preto e branco dramático com alto contraste.
- **Cyberpunk**: Tons de neon e scanlines tecnológicas.
- **Mangá**: Estética PB com retículas e linhas de ação Shonen.
- **Anime**: Cores vibrantes e impacto visual.
- **Horror VHS**: Ruído de fita e tons frios de "Found Footage".

---
Desenvolvido por **Sérgio** com o auxílio do **Antigravity**.
Salinas da Margarida, Bahia, Brasil. 🇧🇷
