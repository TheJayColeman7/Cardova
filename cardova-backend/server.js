// server.js
import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

// Helper function to fetch data from eBay
async function fetchFromEbay(query) {
    try {
        const response = await axios.get("https://svcs.ebay.com/services/search/FindingService/v1", {
            params: {
                "OPERATION-NAME": "findCompletedItems",
                "SERVICE-VERSION": "1.13.0",
                "SECURITY-APPNAME": "YOUR_EBAY_APP_ID",
                "RESPONSE-DATA-FORMAT": "JSON",
                "keywords": query,
                "itemFilter(0).name": "SoldItems",
                "itemFilter(0).value": "true",
            },
        });

        const items = response.data.findCompletedItemsResponse[0].searchResult[0].item || [];
        return items.map((item) => ({
            source: "eBay",
            title: item.title[0],
            price: parseFloat(item.sellingStatus[0].currentPrice[0].__value__),
            date: item.listingInfo[0].endTime[0],
            link: item.viewItemURL[0],
        }));
    } catch (err) {
        console.error("eBay fetch error:", err);
        return [];
    }
}

// Helper function to fetch data from 130point
async function fetchFrom130Point(query) {
    try {
        // Placeholder for 130point API integration
        // You'll need to implement the actual API call based on 130point's documentation
        console.log("130point fetch for query:", query);
        return [];
    } catch (err) {
        console.error("130point fetch error:", err);
        return [];
    }
}

app.get("/api/comps", async(req, res) => {
    const query = req.query.q;
    try {
        const [ebayData, point130Data] = await Promise.all([
            fetchFromEbay(query),
            fetchFrom130Point(query),
            // add more here later
        ]);

        const combined = [...ebayData, ...point130Data];

        // Sort, clean, normalize, or average here
        res.json(combined);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch comp data" });
    }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));