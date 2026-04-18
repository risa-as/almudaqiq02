const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tx = await prisma.transaction.findFirst({
            orderBy: { id: 'desc' },
            include: {
                items: {
                    include: {
                        product: true,
                        unit: true
                    }
                }
            }
        });

        if (!tx) {
            console.log('No transactions found.');
            return;
        }

        console.log('--- Last Transaction ---');
        console.log(`ID: ${tx.id}`);
        console.log(`Date: ${tx.date}`);
        console.log(`Total: ${tx.totalAmount}`);

        console.log('\n--- Items ---');
        tx.items.forEach(item => {
            console.log(`Product: ${item.product.name} (ID: ${item.itemProductId})`);
            console.log(`Quantity: ${item.quantity}`);
            console.log(`Sale Price: ${item.price}`);
            console.log(`Recorded Cost (in Item): ${item.cost}`);
            console.log(`Current Product Base Cost: ${item.product.costPrice}`);
            console.log(`Unit: ${item.unit.name} (Factor: ${item.unit.conversionFactor})`);
            console.log('---------------------------');
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
