export function capitalizarTexto(texto: string | undefined): string | null {
    if(!texto){
        return null;
    }

    if(texto.length === 0){
        return null;
    }

    return texto
      .toLowerCase()
      .split(' ')
      .map((palavra : string) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(' ');
}
  