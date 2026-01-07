import express from 'express';
import multer from 'multer';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadsDir = path.join(__dirname, 'uploads');

console.log(__dirname);

console.log(uploadsDir);

const PORT = 5000

const app = express();

const storage = multer.diskStorage({
    destination: function (req, file, cb)
    {
        cb(null,'uploads/');
    },
    filename: function (req, file, cb)
    {
        cb(null, file.originalname);
    }
})

const upload = multer({ dest: 'uploads/' ,preservePath: true, storage: storage});

app.set('view engine','ejs');

app.get('/',(req,res)=>
{
    res.render('index');
});

app.get('/files',(req,res)=>
{
    const file_list = fs.readdirSync(uploadsDir);

    console.log(file_list);
    res.json(file_list);
});

app.get('/uploads/:filename',(req,res)=>
{
    res.sendFile(uploadsDir +'/'+ req.params.filename);
})

app.get('/uploads/delete/:filename',(req,res)=>
{
    const filePath = path.join(uploadsDir, req.params.filename);

    console.log('Deleting file:', filePath);

    fs.rm(filePath, (err) => {
        if (err)
        {
            console.error('Error deleting file:', err);
            return res.status(500).send('Error deleting file');
        }
        console.log('File deleted successfully');
        res.redirect('/');
    });

})

app.post('/upload',upload.single('file'),(req,res)=>
{
    console.log(req.file.path, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype);
    res.redirect('/');
})

app.listen(PORT, (err)=>
{
    if(err)
    {
        console.log(err);
    }
    console.log('server is listening at port', PORT);
});
