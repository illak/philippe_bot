const Telegraf = require('telegraf');
const axios = require('axios');
const d3 = require('d3');
const htmlToText = require('html-to-text');

const PORT = process.env.PORT || 3000;
const URL = process.env.URL || "https://philippebot.herokuapp.com/";
const BOT_TOKEN = process.env.BOT_APIKEY || '';

const bot = new Telegraf(BOT_TOKEN);


let dataStore = [];
let cursantesUnicos = 0;

getData();

//==========================================================
// Función que obtiene los datos del Spreadsheet
//==========================================================
async function getData() {

    try {
        // Datos de cursantes únicos =============================================
        let cursantesUnicosData = await axios('https://spreadsheets.google.com/feeds/cells/1K2u4GDdhgOQSNuL9qGKR05MjKFYeIErrVR8WT0qeS6w/2/public/full?alt=json');

        let dataCursantesUnicosClean = cursantesUnicosData.data.feed.entry.map(item => {
            return item['gs$cell'].inputValue;
        });

        cursantesUnicos = dataCursantesUnicosClean[1];
        //========================================================================

        // Revisar el mismo enlace pero en vez de "/cells" usar "/list", presenta información por fila
        let res = await axios('https://spreadsheets.google.com/feeds/cells/1K2u4GDdhgOQSNuL9qGKR05MjKFYeIErrVR8WT0qeS6w/1/public/full?alt=json');

        let data = res.data.feed.entry;

        let dataClean = data.map(item => {
            return item['gs$cell'].inputValue;
        });

        let columns = dataClean.splice(0, 18);

        console.log(columns);

        while (dataClean.length > 0) {
            let row = dataClean.splice(0, 18);

            dataStore.push({
                //siglas_carrera
                [columns[0]]: row[0],
                //propuesta
                [columns[1]]: row[1],
                //cohorte
                [columns[2]]: row[2],
                //idedicionmodulo
                [columns[3]]: row[3],
                //siglas_materia
                [columns[4]]: row[4],
                //unidad_curricular
                [columns[5]]: row[5],
                //inicio
                [columns[6]]: new Date(row[6]),
                //fin
                [columns[7]]: new Date(row[7]),
                //nroedicion
                [columns[8]]: row[8],
                //inscriptos
                [columns[9]]: +row[9],
                //inscriptos_condicionales
                [columns[10]]: +row[10],
                //cursando
                [columns[11]]: +row[11],
                //cursando_condicional
                [columns[12]]: +row[12],
                //abandonaron
                [columns[13]]: +row[13],
                //aprobaron
                [columns[14]]: +row[14],
                //reprobaron
                [columns[15]]: +row[15],
                //inactivos
                [columns[16]]: +row[16],
                //desactivados
                [columns[17]]: +row[17]
            });
        }

    } catch (error) {
        console.log(error);
    }

}

// function getHelpMessage(username) {

//     const helpMessage = `
// Hola ${username}, por el momento puedo aceptar los siguientes comandos:

// /hoy - Resumen de números globales al día de hoy
// `;

//     return helpMessage
// }


// //==========================================================
// // Texto de ayuda del bot
// //==========================================================
// bot.help(ctx => {
//     bot.telegram.sendMessage(ctx.chat.id, getHelpMessage(ctx.chat.first_name), {
//         parse_mode: "markdown"
//     })
// })


//==========================================================
// Devuelve números globales al día de hoy
//==========================================================
bot.action('hoy', ctx => {

    ctx.deleteMessage();

    let today = new Date();

    let dataByPropuesta = d3.nest()
        .key(d => d.siglas_carrera)
        .key(d => d.idedicionmodulo)
        .sortValues((a, b) => a.anio - b.anio).entries(dataStore);


    let propuestas = d3.nest()
        .key(d => d.siglas_carrera)
        .entries(dataStore).map(d => d.key);

    filteredData = [].concat.apply([], dataByPropuesta.map(d => d.values));

    let todayData = filteredData.filter(d => d.values[0].inicio <= Date.now() & d.values[0].fin >= Date.now());

    let propuestas2020 = [...new Set(todayData.map(d => d.values[0].propuesta))].length;

    let res = `
    ${ctx.chat.first_name}, estos son los números de ISEP al dia de hoy: *${today.getDate()}/${today.getMonth()}/${today.getFullYear()}*

- Hay *${cursantesUnicos}* personas cursando alguna unidad curricular en ISEP.
- Hay *${d3.sum(todayData, d => d3.sum(d.values, d => +d.cursando) + d3.sum(d.values, d => +d.cursando_condicional) +
        d3.sum(d.values, d => +d.inscriptos) + d3.sum(d.values, d => +d.inscriptos_condicionales) +
        d3.sum(d.values, d => +d.desactivados) + d3.sum(d.values, d => +d.aprobaron) +
        d3.sum(d.values, d => +d.reprobaron) + d3.sum(d.values, d => +d.abandonaron))}* inscripciones
- en *${todayData.length}* unidades curriculares
- pertenecientes a *${propuestas2020}* propuestas.
    `

    bot.telegram.sendMessage(ctx.chat.id, res,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Volver al menú principal', callback_data: 'start' }
                    ]
                ]
            }
        })

})

//==========================================================
// Lista la cantidad total de cursantes
//==========================================================
bot.command('cursando', ctx => {
    let input = ctx.message.text;
    let inputArray = input.split(" ");

    ctx.telegram.sendChatAction(ctx.chat.id, 'typing');



    if (inputArray.length === 1) {

        let todayData = dataStore.filter(d => d.inicio <= Date.now() & d.fin >= Date.now());
        let cursandoTotales = d3.sum(todayData, d => +d.cursando + +d.cursando_condicional);

        let today = new Date();

        //ctx.replyWithMarkdown(`Al dia de hoy ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()} hay ${cursandoTotales} personas cursando en ${todayData.length} modulos`);

        let message = `Al dia de hoy *${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}* hay *${cursandoTotales}* personas cursando en *${todayData.length}* modulos`

        // ctx.chat.id detect if called from group or individual
        bot.telegram.sendMessage(ctx.chat.id, message, {
            parse_mode: "markdown"
        })


    } else {
        console.log('Mas de un input!');
    }



});

//==========================================================
// Lista las unidades curriculares y los cursantes actuales
//==========================================================
bot.command('modulos', ctx => {
    let input = ctx.message.text;
    let inputArray = input.split(" ");

    ctx.telegram.sendChatAction(ctx.chat.id, 'typing');



    if (inputArray.length === 1) {

        let todayData = dataStore.filter(d => d.inicio <= Date.now() & d.fin >= Date.now());

        console.log(todayData);

        let message = 'Estos son los módulos que se están cursando actualmente: \n\n';

        todayData.forEach(data => {
            message += `*${data.siglas_materia}*: ${data.cursando + data.cursando_condicional} \n`
        })

        // ctx.chat.id detect if called from group or individual
        bot.telegram.sendMessage(ctx.chat.id, message, {
            parse_mode: "markdown"
        })


    } else {
        console.log('Mas de un input!');
    }

});

bot.command('start', ctx => {
    sendStartMessage(ctx);
});

bot.action('start', ctx => {
    ctx.deleteMessage();
    sendStartMessage(ctx);
})

function sendStartMessage(ctx) {
    let startMessage = `Hola ${ctx.chat.first_name}, soy _PhilippeBOT_ y mi función es proveer información relacionada al estado actual del ISEP.
    \nPor favor selecciona una opción del menú.`;

    bot.telegram.sendMessage(ctx.chat.id, startMessage,
        {
            parse_mode: "markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📅 Datos de hoy', callback_data: 'hoy' }
                    ],
                    [
                        { text: '📊 Monitor de cursada', url: 'https://sites.google.com/isep-cba.edu.ar/areaevaluacion/' }
                    ]
                ]
            }
        })
}

// Si recibe cualquier texto, muestra el menú
bot.on('text', (ctx) => {
    sendStartMessage(ctx);
});

bot.telegram.setWebhook(`${URL}:443/bot${BOT_TOKEN}`);
bot.startWebhook(`/bot${BOT_TOKEN}`, null, PORT);

//bot.launch();