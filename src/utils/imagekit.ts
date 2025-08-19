import ImageKit from 'imagekit';
import 'dotenv/config';
import sharp from 'sharp';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function renameImage(filePath: string, newFileName: string, folder : string): Promise<boolean> {
  try {
    await imagekit.renameFile({
        filePath: filePath,
        newFileName: `${newFileName}.png`,
        purgeCache: false, // optional
    });

    //console.log(`[ImageKit] Arquivo renomeado com sucesso:`, `${newFileName}.png`);
    return true;
  } catch (error) {
    console.error(`[ImageKit] Erro ao renomear imagem com ID ${filePath}:`, error);
    return false;
  }
}

async function compressImage(buffer: Buffer, targetSizeKB: number): Promise<Buffer> {
  let quality = 80; // Qualidade inicial
  let result = await sharp(buffer)
    .png({ quality })
    .toBuffer();
  
  // Se a imagem já estiver menor que o tamanho alvo, retorna
  if (result.length <= targetSizeKB * 1024) {
    return result;
  }

  // Reduz a qualidade até atingir o tamanho desejado
  while (result.length > targetSizeKB * 1024 && quality > 10) {
    quality -= 5;
    result = await sharp(buffer)
      .png({ 
        quality,
        compressionLevel: 9, // Máxima compressão
        adaptiveFiltering: true,
        force: true
      })
      .toBuffer();
  }

  // Se ainda estiver muito grande, redimensiona a imagem mantendo a proporção
  if (result.length > targetSizeKB * 1024) {
    const metadata = await sharp(result).metadata();
    const scale = Math.sqrt((targetSizeKB * 1024) / result.length) * 0.9; // 90% do tamanho calculado para garantir
    const newWidth = Math.round((metadata.width || 1000) * scale);
    
    result = await sharp(result)
      .resize(newWidth, null, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .png({ 
        quality: Math.max(quality, 20), // Garante uma qualidade mínima
        compressionLevel: 9
      })
      .toBuffer();
  }

  return result;
}

export async function uploadImage(buffer: Buffer, filename: string, folder: string): Promise<string> {
  //console.log('[ImageKit] Enviando imagem:', filename);
  
  // Comprime a imagem para no máximo 10KB
  const maxSizeKB = 20;
  const compressedBuffer = await compressImage(buffer, maxSizeKB);
  
  //console.log(`[ImageKit] Tamanho original: ${(buffer.length / 1024).toFixed(2)}KB, ` +
              `Comprimido: ${(compressedBuffer.length / 1024).toFixed(2)}KB`);

  const tempFileName = `${Date.now()}_${filename}.png`;

  const result = await imagekit.upload({
    file: compressedBuffer,
    fileName: tempFileName,
    folder: folder,
  });

  const newName = await renameImage(result.filePath, result.fileId, folder);

  //console.log('[ImageKit] Upload concluído:', newName);
  return result.fileId;
}

export async function deleteImages(fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    try {
      await imagekit.deleteFile(fileId);
      //console.log(`[ImageKit] Imagem com ID ${fileId} deletada com sucesso.`);
    } catch (error) {
      console.error(`[ImageKit] Erro ao deletar imagem com ID ${fileId}:`, error);
    }
  }
}

export async function processAndUploadImage(imageField: any, folder: string): Promise<string | null> {
  if (!imageField) return null;

  //console.log('[processAndUploadImage] Iniciando processamento da imagem...');
  //console.log('[processAndUploadImage] Stream legível:', imageField.file.readable);

  let imageBuffer: Buffer;

  try {
    if (typeof imageField.toBuffer === 'function') {
      // Usa o método nativo se disponível
      imageBuffer = await imageField.toBuffer();
    } else {
      // Lê manualmente o stream
      const chunks: Buffer[] = [];
      for await (const chunk of imageField.file) {
        chunks.push(chunk);
      }
      imageBuffer = Buffer.concat(chunks);
    }

    //console.log('[processAndUploadImage] Tamanho do buffer:', imageBuffer.length);
    //console.log('[processAndUploadImage] Primeiros bytes:', imageBuffer.subarray(0, 10));

    const filename = imageField.filename || 'imagem.jpg';

    const imageUrl = await uploadImage(imageBuffer, filename, folder);
    //console.log('[processAndUploadImage] Upload concluído:', imageUrl);

    return imageUrl;

  } catch (err) {
    console.error('[processAndUploadImage] Erro ao processar ou fazer upload da imagem:', err);
    throw err;
  }
}
