import fs from 'fs';
import { ENV } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';
import { Readable } from 'stream';
import { drive } from '../../config/driveConfig.js';

async function getOrCreateFolder(folderName: string, parentId: string): Promise<string> {
    const response = await drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
        fields: 'files(id)',
    });

    if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0]?.id as string;
    }

    const folder = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
    });

    return folder.data.id as string;
}


export async function uploadFileToDrive(file: Express.Multer.File, fileName: string, mainFolderId: string, userFullName: string) {
    try {
        const dateFolderName = new Date().toISOString().split('T')[0] as string;
        const dateFolderId = await getOrCreateFolder(dateFolderName, mainFolderId);

        const userFolderName = `${userFullName}`;
        const userFolderId = await getOrCreateFolder(userFolderName, dateFolderId);

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [userFolderId],
            },
            media: {
                mimeType: file.mimetype,
                body: Readable.from(file.buffer),
            },
            fields: 'id',
        });

        return response.data;
    } catch (error) {
        console.error('Google Drive Upload Error:', error);
        if (fs.existsSync(file.path)) {
            await fs.promises.unlink(file.path).catch(() => { });
        }
        throw new AppError('ไม่สามารถอัปโหลดไฟล์ไปยัง Cloud ได้', 500);
    }
}