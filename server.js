const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const session = require('express-session');
const crypto = require('crypto');
const app = express();
const port = 3000;

app.use(express.static('public'));


app.use(express.json());
app.use(
  session({
    secret: '778df871ddbff56022a790c0cae63cc7487e901a55751fcae51e4d969fdb180f',
    resave: false,
    
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);


const db = new sqlite3.Database('user1.db');




db.run(`
CREATE TABLE IF NOT EXISTS property (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_name TEXT,
  owner_email TEXT,
  monthly_rent INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  location TEXT,
  size TEXT,
  available_from DATE,
  property_type TEXT,
  image_url TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS user1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  contact_number TEXT,
  password TEXT
)`);


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});



app.post('/register', express.json(), (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const contact_number = req.body.contact_number;
  const password = req.body.password;

  // Hash the password using bcrypt
  bcrypt.hash(password, 10, function(err, hash) {
    db.get('SELECT * FROM user1 WHERE email = ?', [email], function(err, row) {
      if (err) {
        console.error('Error hashing password:', err);
        res.status(500).json({ error: 'Error registering user1' });
      } 
      else if (row) {
        res.status(400).json({ error: 'Email already exists' });
      }
      else {
        // Insert the new user into the database
        db.run(
          `INSERT INTO user1 (name, email, contact_number, password) VALUES (?, ?, ?, ?)`,
          [name, email, contact_number, hash],
          function(err) {
            if (err) {
              console.error('Error registering user1:', err);
              res.status(500).json({ error: 'Error registering user1' });
            } else {
              res.sendStatus(200);
            }
          }
        );
      }
    });
  });
});

app.post('/login', express.json(), (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Retrieve the user from the database
  db.get('SELECT * FROM user1 WHERE email = ?', [email], function(err, row) {
    if (err) {
      console.error('Error logging in user1:', err);
      res.status(500).json({ error: 'An error occurred' });
    } else if (!row) {
      res.status(401).json({ error: 'Email not found' });
    } else {
      // Compare the provided password with the stored hash
      bcrypt.compare(password, row.password, function(err, result) {
        if (err || !result) {
          console.error('Error logging in user1:', err);
          res.status(401).json({ error: 'Invalid email or password' });
        } else {
          const loggedInUsername = row.name;
          const loggedInEmail = row.email;
          req.session.email = loggedInEmail;
          req.session.username=loggedInUsername;
          
          res.status(200).json({ message: 'Login successful', username: loggedInUsername, email: loggedInEmail });
        }
      });
    }
  });
});


app.get('/all-properties', (req, res) => {
    const query = `
        SELECT owner_name, monthly_rent, location, bedrooms, bathrooms, size,image_url
        FROM property
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching all properties:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json(rows);
        }
    });
});



app.post('/add-property', express.json(), (req, res) => {
    const ownerName = req.body.ownerName;
    const ownerEmail = req.body.ownerEmail;
    const monthlyRent = req.body.monthlyRent;
    const bedrooms = req.body.bedrooms;
    const bathrooms = req.body.bathrooms;
    const location = req.body.location;
    const size = req.body.size;
    const availableFrom = req.body.availableFrom;
    const propertyType = req.body.propertyType;
    const propertyImageUrl = req.body.propertyImageUrl; 

    db.run(
        `INSERT INTO property (
            owner_name, owner_email, monthly_rent, bedrooms, bathrooms, location, size, available_from, property_type, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ownerName, ownerEmail, monthlyRent, bedrooms, bathrooms, location, size, availableFrom, propertyType, propertyImageUrl],
        function (err) {
            if (err) {
                console.error('Error adding property:', err);
                res.status(500).json({ error: 'Error adding property' });
            } else {
                res.sendStatus(200);
            }
        }
    );
});


/*
app.get('/list-properties', (req, res) => {
  const city = req.query.city;
  const availableFrom = req.query.availableFrom ; 
  const minPrice = 100;
  const maxPrice = req.query.price;
  const propertyType = req.query.propertyType;

  const query = `
    SELECT *
    FROM property
    WHERE location = ? 
      AND monthly_rent BETWEEN ? AND ?
      AND available_from >= ?
      AND property_type = ?
  `;

  db.all(query, [city, minPrice, maxPrice, availableFrom, propertyType], (err, rows) => {
    if (err) {
      console.error('Error fetching filtered properties:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.status(200).json(rows);
    }
  });
});
*/

app.get('/list-properties', (req, res) => {
  let city = req.query.city;
  let availableFrom = req.query.availableFrom;
  const minPrice = 100;
  const maxPrice = req.query.price;
  let propertyType = req.query.propertyType;

  let cityCondition = '';
  let propertyTypeCondition = '';
  let availableFromCondition = '';

  if (city === 'all') {
    cityCondition = '1=1'; 
  } else {
    cityCondition = 'location = ?';
  }

  if (propertyType === 'all') {
    propertyTypeCondition = '1=1'; 
  } else {
    propertyTypeCondition = 'property_type = ?';
  }

  if (!availableFrom) {
    availableFromCondition = '1=1'; 
  } else {
    availableFromCondition = 'available_from >= ?';
  }

  const query = `
    SELECT *
    FROM property
    WHERE ${cityCondition}
      AND monthly_rent BETWEEN ? AND ?
      AND ${availableFromCondition}
      AND ${propertyTypeCondition}
  `;

  
  const params = [];
  if (city !== 'all') params.push(city);
  params.push(minPrice, maxPrice);
  if (availableFrom) params.push(availableFrom);
  if (propertyType !== 'all') params.push(propertyType);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching filtered properties:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.status(200).json(rows);
    }
  });
});


app.get('/owner-properties', (req, res) => {
    const ownerEmail = req.session.email;
  

    const query = `
        SELECT owner_name AS name, monthly_rent AS price, location, bedrooms, bathrooms, size,image_url
        FROM property
        WHERE owner_email = ?
    `;

    db.all(query, [ownerEmail], (err, rows) => {
        if (err) {
            console.error('Error fetching owner properties:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json(rows);
        }
    });
});



app.post('/update-property', express.json(), async (req, res) => {
    try {
      const mail=req.session.email;
        const oldName = req.body.oldName;
        const oldMonthlyRent = req.body.oldPrice;
        
        const oldLocation = req.body.oldLocation;
        const oldBedrooms = req.body.oldBedrooms;
        const oldBathrooms = req.body.oldBathrooms;
        const oldSize = req.body.oldSize;
        const oldImageUrl = req.body.oldImageUrl;

        const newName = req.body.newName;
        const newMonthlyRent = req.body.newPrice;
        const newLocation = req.body.newLocation;
        const newBedrooms = req.body.newBedrooms;
        const newBathrooms = req.body.newBathrooms;
        const newSize = req.body.newSize;
        const newImageUrl = req.body.newImageUrl;

        const existingProperty = await getPropertyFromDatabase(mail,oldName, oldMonthlyRent, oldLocation, oldBedrooms, oldBathrooms, oldSize, oldImageUrl);

        if (existingProperty) {
            await updatePropertyInDatabase(mail,oldName, oldMonthlyRent, oldLocation, oldBedrooms, oldBathrooms, oldSize, oldImageUrl, newName, newMonthlyRent, newLocation, newBedrooms, newBathrooms, newSize, newImageUrl);

            res.sendStatus(200);
        } else {
            res.status(404).json({ error: 'Property not found' });
        }
    } catch (error) {
        console.error('Error updating property:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function getPropertyFromDatabase(mail,name, monthlyRent, location, bedrooms, bathrooms, size, imageUrl) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM property WHERE owner_email = ? AND owner_name = ? AND monthly_rent = ? AND location = ? AND bedrooms = ? AND bathrooms = ? AND size = ? AND image_url = ? LIMIT 1';
        db.get(query, [mail,name, monthlyRent, location, bedrooms, bathrooms, size, imageUrl], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function updatePropertyInDatabase(mail,oldName, oldMonthlyRent, oldLocation, oldBedrooms, oldBathrooms, oldSize, oldImageUrl, newName, newMonthlyRent, newLocation, newBedrooms, newBathrooms, newSize, newImageUrl) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE property SET owner_name = ?, monthly_rent = ?, location = ?, bedrooms = ?, bathrooms = ?, size = ?, image_url = ? WHERE owner_email=? AND owner_name = ? AND monthly_rent = ? AND location = ? AND bedrooms = ? AND bathrooms = ? AND size = ? AND image_url = ?';
        db.run(query, [newName, newMonthlyRent, newLocation, newBedrooms, newBathrooms, newSize, newImageUrl,mail, oldName, oldMonthlyRent, oldLocation, oldBedrooms, oldBathrooms, oldSize, oldImageUrl], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}




app.post('/delete-property', express.json(), async (req, res) => {
    try {
        const mail=req.session.email;
        const ownerName = req.body.ownerName;
        const monthlyRent = req.body.monthlyRent;
        const location = req.body.location;
        const bedrooms = req.body.bedrooms;
        const bathrooms = req.body.bathrooms;
        const size = req.body.size;
        const imageUrl = req.body.imageUrl;

        
        const existingProperty = await getPropertyFromDatabase(mail,ownerName, monthlyRent, location, bedrooms, bathrooms, size, imageUrl);

        if (existingProperty) {
            
            await deletePropertyFromDatabase(mail,ownerName, monthlyRent, location, bedrooms, bathrooms, size, imageUrl);

            res.sendStatus(200);
        } else {
            res.status(404).json({ error: 'Property not found' });
        }
    } catch (error) {
        console.error('Error deleting property:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


async function deletePropertyFromDatabase(mail,ownerName, monthlyRent, location, bedrooms, bathrooms, size, imageUrl) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM property WHERE owner_email=? AND owner_name = ? AND monthly_rent = ? AND location = ? AND bedrooms = ? AND bathrooms = ? AND size = ? AND image_url = ?';
        db.run(query, [mail,ownerName, monthlyRent, location, bedrooms, bathrooms, size, imageUrl], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}


app.get('/authenticated-user', (req, res) => {
    const userEmail = req.session.email;

    if (userEmail) {
        res.status(200).json({ email: userEmail });
    } else {
        res.status(401).json({ error: 'User not authenticated' });
    }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});