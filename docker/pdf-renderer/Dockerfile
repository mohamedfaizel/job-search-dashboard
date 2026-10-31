# pdf-renderer: XeLaTeX with the TeX Gyre fonts, and LibreOffice for Word files, behind a tiny
# HTTP server (server.py).
# Built and started with `pnpm pdf:up`. Only our API talks to it.
# Ubuntu 24.04: the same TeX Live 2023 packages the templates were tested with.
FROM ubuntu:24.04

# --no-install-recommends keeps the image small: only the LaTeX packages the templates use.
# Carlito, Caladea and Liberation have the same letter widths as Calibri, Cambria, Arial and
# Times New Roman, so a Word resume keeps its line breaks and page count.
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    texlive-xetex texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended \
    fonts-texgyre lmodern python3 \
    libreoffice-writer-nogui fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Run as a normal user, not root.
RUN useradd --create-home renderer
USER renderer
WORKDIR /home/renderer
COPY server.py .

ENV PORT=8090
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8090/health')"
CMD ["python3", "server.py"]
