import express from 'express';
import multer from 'multer';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from "archiver";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadsDir = path.join(__dirname, 'uploads');

console.log(__dirname);

console.log(uploadsDir);

const PORT = 5000

const app = express();

//LOCAL STORAGE

const storage = multer.diskStorage({
    destination: function (req, file, cb)
    {
        let baseUploadDir = path.join(__dirname,'uploads');

        let filepath = file.originalname;
        
        console.log(filepath);

        filepath = path.normalize(filepath).replace(/(\.\.(\/|\\|))/g, '');

        console.log(filepath);

        const fileDir = path.dirname(filepath);

        console.log(fileDir);

        const finalDir = path.join(baseUploadDir, fileDir);

        console.log(finalDir);

        // Verify the resolved path is still within baseUploadDir (security check)
        const realPath = path.resolve(finalDir);
        if (!realPath.startsWith(path.resolve(baseUploadDir))) {
        return cb(new Error('Invalid file path'));
        }

        fs.mkdirSync(finalDir, { recursive: true });

        cb(null, finalDir);
    },
    filename: function (req, file, cb)
    {

        console.log(req.files);
        cb(null, path.basename(file.originalname));
    }
})

// const storage = new MulterAzureBlobStorage({
//     accountName: process.env.STORAGE_ACCOUNT_NAME,
//     connectionString: process.env.STORAGE_CONNECTION_STRING,
//     containerName: process.env.CONTAINER_NAME,
//     accessKey: process.env.ACCESS_KEY,
//     blobName: (req, file, cb) => {
//         cb(null, file.originalname);
//     }
// })

function fileOrDir(filename)
{
    const targetPath = path.join(uploadsDir, filename);

    try {
        const stats = fs.statSync(targetPath);
        if (stats.isFile()) {
            return 1;
        } else if (stats.isDirectory()) {
            return -1;
        } else {
            console.log(`${targetPath} is neither a file nor a directory`);
        }
        } catch (error) {
        console.error(`Error checking path: ${error.message}`);
    }
}

const upload = multer({preservePath: true, storage: storage });

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views','static')));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/files', (req, res) => {
    const file_list = fs.readdirSync(uploadsDir);

    console.log(file_list);
    res.json(file_list);
});

app.get('/uploads/:filename', (req, res) => {
    
    if(fileOrDir(req.params.filename) === 1)
    {
        res.sendFile(path.join(uploadsDir, req.params.filename));
    }
    else
    {
        const folderpath = path.join(uploadsDir, req.params.filename);
            res.attachment(`${req.params.filename}.zip`);
            const archive = archiver('zip',{
                zlib: { level : 9}
            });

            archive.pipe(res);

            archive.directory(folderpath, false);

            archive.finalize();
    }
})

app.get('/uploads/delete/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);

    console.log('Deleting file:', filePath);

    if(fileOrDir(req.params.filename) === 1)
    {
        fs.rm(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).send('Error deleting file');
        }
        console.log('File deleted successfully');
        res.redirect('/');
    });
    }
    else
    {
        fs.rm(filePath, { recursive: true, force: true }, (err) => {
            if (err) {
                console.error('Error deleting directory:', err);
                return res.status(500).send('Error deleting directory');
            }
            console.log('Directory deleted successfully');
            res.redirect('/');
        }
        );
    }

    

})

app.post('/upload', upload.array('files'), (req, res) => {
    // console.log(req.files);
    res.redirect('/');
})

app.listen(PORT, (err) => {
    if (err) {
        console.log(err);
    }
    console.log('server is listening at port', PORT);
});
