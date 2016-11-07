module.exports = function(app) {
    const client = app.locals.db
    var auth = app.locals.auth

    app.get("/accounts", auth, (req, res) => {
        var renderData = {
            layout: "bulkSMS",
            session: req.session,
            status: "Online",
            page: "Accounts"
        }

        res.render("accounts/dashboard", renderData)
    })
}
