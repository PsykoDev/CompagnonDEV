/** @format */

const { BADQUERY } = require("dns")
const fs = require("fs"),
  path = require("path"),
  zlib = require("zlib"),
  crypto = require("crypto"),
  fetch = require("node-fetch")
const { off } = require("process")
const UploadServerURLs = ["http://localhost/"]
const { dungeons, card, inventory } = require("./config.json")
const json = JSON.parse(fs.readFileSync(path.join(__dirname, "./data/items.json"), "utf8"))
const dungeon = JSON.parse(fs.readFileSync(path.join(__dirname, "./data/dungeons.json"), "utf8"))
const benefit = JSON.parse(fs.readFileSync(path.join(__dirname, "./data/benefits.json"), "utf8"))
const achiv = JSON.parse(fs.readFileSync(path.join(__dirname, "./data/achi.json"), "utf8"))
const convertDate = require("./functions/convertDate.js")
const tryUploadSession = require("./functions/upload.js")

class DataLogger {
  constructor(mod) {
    this.mod = mod
    this.isOnServerEmulator = false
    this.StateTracker = mod.require.DataTracker
    this.reset()
    this.installHooks(mod)
  }

  destructor() {
    this.finishSession()
  }

  installSend(mod, name, version, cb) {
    mod.send(name, version, { order: -999, filter: { fake: false, modified: false, silenced: null } }, cb)
  }

  installHook(mod, name, version, cb) {
    mod.hook(name, version, { order: -999, filter: { fake: false, modified: false, silenced: null } }, cb)
  }

  installHookBeforeTracker(mod, name, version, cb) {
    mod.hook(name, version, { order: -1001, filter: { fake: false, modified: false, silenced: null } }, cb)
  }

  installHooks(mod) {
    this.installHook(mod, "S_LOGIN_ACCOUNT_INFO", 3, (event) => {
      this.isOnServerEmulator = event.dbServerName.includes("ServerEmulator")
    })

    let Empty = { fr: "vide", en: "empty", ger: "leer" }
    let Pet = { 0: "No", 1: "Progress", 2: "Finish" }
    let Class = { 0: "warrior", 1: "lancer", 2: "slayer", 3: "berseker", 4: "sorcerer", 5: "archer", 6: "priest", 7: "mystic", 8: "reaper", 9: "gunner", 10: "brawler", 11: "ninja", 12: "valkyrie", 13: "common" }
    this.installHook(mod, "S_GET_USER_LIST", 20, (event) => {
      this.LoggedData["maxcharacters"] = event.maxCharacters
      this.LoggedData["veteran"] = event.veteran
      this.LoggedData["userlist"] = []
      this.LoggedData["userlist"].splice(0, this.LoggedData["userlist"].length)
      let char = event.characters
      char.forEach((ch) => {
        var ilvl = ch.itemLevel
        ilvl = Math.floor(ilvl * 100) / 100
        this.LoggedData["userlist"].push({
          name: ch.name, //player name
          class: Class[ch.class], //player class
          id: ch.id, //Player ID
          laurel: ch.laurel == 0 ? Empty : achiv[ch.laurel], //# -1..5 (none, none, bronze, silver, gold, diamond, champion)
          guildname: ch.guildName, //player guild name
          level: ch.level, // player lvl
          adventurecoins: ch.adventureCoins, //player aventure coins remaining
          hasbrokersales: ch.hasBrokerSales, // player has dell in broker
          petadventurestatus: Pet[ch.petAdventureStatus], // player partener aventures # 0: inactive, 1: active, 2: finished

          //Weapon: ch.weapon,
          weaponname: ch.weapon == 0 ? Empty : json[ch.weapon],
          //Earring1: ch.earring1,
          earring1name: ch.earring1 == 0 ? Empty : json[ch.earring1],
          //Ring1: ch.ring1,
          ring1name: ch.ring1 == 0 ? Empty : json[ch.ring1],
          //Body: ch.body,
          bodyname: ch.body == 0 ? Empty : json[ch.body],
          //Hand: ch.hand,
          handname: ch.hand == 0 ? Empty : json[ch.hand],
          //Feet: ch.feet,
          feetname: ch.feet == 0 ? Empty : json[ch.feet],
          //Earring2: ch.earring2,
          earring2name: ch.earring2 == 0 ? Empty : json[ch.earring2],
          //Ring2: ch.ring2,
          ring2name: ch.ring2 == 0 ? Empty : json[ch.ring2],
          //Underwear: ch.underwear,
          underwearname: ch.underwear == 0 ? Empty : json[ch.underwear],
          //Head: ch.head,
          headname: ch.head == 0 ? Empty : json[ch.head],
          //Face: ch.face,
          facename: ch.face == 0 ? Empty : json[ch.face],
          itemlevel: ilvl.toFixed(5),
        })
      })
    })
    // # 0: inventory/pocket, 1: bank, 2: mail, 3: guild bank, 4: homunculus shop, 5: homunculus shop buy, 6: trade broker sale, 7: group duel betting pool, 9: pet bank, 12: wardrobe, 14: equipment

    //Offset Bank: 0 Page 1
    //Offset Bank: 72 page 2
    //Offset Bank: 144 page 3
    //Offset Bank: 216 page 4
    //Offset Bank: 288 page 5
    //Offset Bank: 360 page 6
    //Offset Bank: 432 page7
    //Offset Bank: 504 page 8
    //Offset Pet: 0 Page 1
    //Offset Pet: 72 page 2
    //Offset Pet: 144 page 3
    //Offset Pet: 216 page 4
    //Offset Pet: 288 page 5

    //Bank / Pet
    this.installHook(mod, "S_VIEW_WARE_EX", 3, (event) => {
      let money_bank = event.money.toString() / 10000
      if (event.container === 1) {
        this.LoggedData["bank"]["bankgid"] = event.gameId.toString()
        this.LoggedData["bank"]["containetypebank"] = event.container
        this.LoggedData["bank"]["moneybank"] = money_bank
        let char = event.items
        let off = event.offset
        //this.LoggedData["bank"]["OwnerId_Bank"] = ch.ownerId.toString();
        switch (off) {
          case 0:
            this.LoggedData["bank"]["bankcont"]["page1"] = []
            this.LoggedData["bank"]["bankcont"]["page1"].splice(0, this.LoggedData["bank"]["bankcont"]["page1"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["owneridbank"] = ch.ownerId.toString()
              this.LoggedData["bank"]["bankcont"]["page1"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 72:
            this.LoggedData["bank"]["bankcont"]["page2"] = []
            this.LoggedData["bank"]["bankcont"]["page2"].splice(0, this.LoggedData["bank"]["bankcont"]["page2"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page2"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 144:
            this.LoggedData["bank"]["bankcont"]["page3"] = []
            this.LoggedData["bank"]["bankcont"]["page3"].splice(0, this.LoggedData["bank"]["bankcont"]["page3"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page3"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 216:
            this.LoggedData["bank"]["bankcont"]["page4"] = []
            this.LoggedData["bank"]["bankcont"]["page4"].splice(0, this.LoggedData["bank"]["bankcont"]["page4"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page4"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 288:
            this.LoggedData["bank"]["bankcont"]["page5"] = []
            this.LoggedData["bank"]["bankcont"]["page5"].splice(0, this.LoggedData["bank"]["bankcont"]["page5"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page5"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 360:
            this.LoggedData["bank"]["bankcont"]["page6"] = []
            this.LoggedData["bank"]["bankcont"]["page6"].splice(0, this.LoggedData["bank"]["bankcont"]["page6"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page6"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 432:
            this.LoggedData["bank"]["bankcont"]["page7"] = []
            this.LoggedData["bank"]["bankcont"]["page7"].splice(0, this.LoggedData["bank"]["bankcont"]["page7"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page7"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 504:
            this.LoggedData["bank"]["bankcont"]["page8"] = []
            this.LoggedData["bank"]["bankcont"]["page8"].splice(0, this.LoggedData["bank"]["bankcont"]["page8"].length)
            char.forEach((ch) => {
              this.LoggedData["bank"]["bankcont"]["page8"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
        }
      }
      if (event.container === 9) {
        this.LoggedData["pet"]["petgid"] = event.gameId.toString()
        this.LoggedData["pet"]["containetypepet"] = event.container
        let char = event.items
        let off = event.offset
        switch (off) {
          case 0:
            this.LoggedData["pet"]["petcont"]["page1"] = []
            this.LoggedData["pet"]["petcont"]["page1"].splice(0, this.LoggedData["pet"]["petcont"]["page1"].length)
            char.forEach((ch) => {
              this.LoggedData["pet"]["owneridpet"] = ch.ownerId.toString()
              this.LoggedData["pet"]["petcont"]["page1"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 72:
            this.LoggedData["pet"]["petcont"]["page2"] = []
            this.LoggedData["pet"]["petcont"]["page2"].splice(0, this.LoggedData["pet"]["petcont"]["page2"].length)
            char.forEach((ch) => {
              this.LoggedData["pet"]["petcont"]["page2"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 144:
            this.LoggedData["pet"]["petcont"]["page3"] = []
            this.LoggedData["pet"]["petcont"]["page3"].splice(0, this.LoggedData["pet"]["petcont"]["page3"].length)
            char.forEach((ch) => {
              this.LoggedData["pet"]["petcont"]["page3"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 216:
            this.LoggedData["pet"]["petcont"]["page4"] = []
            this.LoggedData["pet"]["petcont"]["page4"].splice(0, this.LoggedData["pet"]["petcont"]["page4"].length)
            char.forEach((ch) => {
              this.LoggedData["pet"]["petcont"]["page4"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
          case 288:
            this.LoggedData["pet"]["petcont"]["page5"] = []
            this.LoggedData["pet"]["petcont"]["page5"].splice(0, this.LoggedData["pet"]["petcont"]["page5"].length)
            char.forEach((ch) => {
              this.LoggedData["pet"]["petcont"]["page5"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                amounttotal: ch.amountTotal, //total item in bank
              })
            })
            break
        }
      }
    })
    //inventory
    this.installHook(mod, "S_ITEMLIST", 4, (event) => {
      let money_inv = event.money.toString() / 10000
      if (event.container === 0) {
        this.LoggedData["inventory"]["invengid"] = event.gameId.toString()
        this.LoggedData["inventory"]["moneyinv"] = money_inv
        let char = event.items
        switch (event.pocket) {
          case 0:
            if (event.container == 0) {
              this.LoggedData["inventory"]["inventorycont"] = []
              this.LoggedData["inventory"]["inventorycont"].splice(0, this.LoggedData["inventory"]["inventorycont"].length)
              char.forEach((ch) => {
                this.LoggedData["inventory"]["owneridinv"] = ch.ownerId.toString()
                this.LoggedData["inventory"]["inventorycont"].push({
                  id: ch.id, //Item ID
                  name: json[ch.id],
                  //Slot: ch.slot,
                  amount: ch.amount,
                })
              })
            }
            break
          case 1:
            this.LoggedData["inventory"]["pocket1"] = []
            this.LoggedData["inventory"]["pocket1"].splice(0, this.LoggedData["inventory"]["pocket1"].length)
            char.forEach((ch) => {
              this.LoggedData["inventory"]["pocket1"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                //Slot: ch.slot,
                amount: ch.amount,
              })
            })
            break
          case 2:
            this.LoggedData["inventory"]["pocket2"] = []
            this.LoggedData["inventory"]["pocket2"].splice(0, this.LoggedData["inventory"]["pocket2"].length)
            char.forEach((ch) => {
              this.LoggedData["inventory"]["pocket2"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                //Slot: ch.slot,
                amount: ch.amount,
              })
            })
            break
          case 3:
            this.LoggedData["inventory"]["pocket3"] = []
            this.LoggedData["inventory"]["pocket3"].splice(0, this.LoggedData["inventory"]["pocket3"].length)
            char.forEach((ch) => {
              this.LoggedData["inventory"]["pocket3"].push({
                id: ch.id, //Item ID
                name: json[ch.id],
                //Slot: ch.slot,
                amount: ch.amount,
              })
            })
            break
        }
      }
    })

    this.installHook(mod, "S_CARD_DATA", 1, (e) => {
      this.LoggedData["carddata"]["playername"] = e.playerName
      this.LoggedData["carddata"]["maxcard"] = 515
      this.LoggedData["carddata"]["card"] = []
      this.LoggedData["carddata"]["card"].splice(0, this.LoggedData["carddata"]["card"].length)
      let card = e.cards
      card.forEach((ch) => {
        this.LoggedData["carddata"]["card"].push({
          id: ch.id,
          name: json[ch.id],
          quantity: ch.quantity,
        })
      })
      var count = this.LoggedData["carddata"]["card"].length
      this.LoggedData["carddata"]["actualcard"] = count
    })

    this.installHook(mod, "S_ACCOUNT_PACKAGE_LIST", 3, (event) => {
      this.LoggedData["accountbenefit"] = []
      this.LoggedData["accountbenefit"].splice(0, this.LoggedData["accountbenefit"].length)
      let char = event.accountBenefits
      char.forEach((ch) => {
        let skip = ch.expirationDate.toString()
        this.LoggedData["accountbenefit"].push({
          id: ch.packageId,
          name: benefit[ch.packageId],
          expirationdate: convertDate(skip),
        })
      })
    })

    this.installHook(mod, "S_AVAILABLE_EVENT_MATCHING_LIST", 3, (event) => {
      this.LoggedData["hquest"] = []
      this.LoggedData["hquest"].splice(0, this.LoggedData["hquest"].length)
      this.LoggedData["hquest"].push({
        totalcompleted: event.totalCompleted,
        dungeoncompleted: event.dungeonCompleted,
        pvpcompleted: event.chpvpCompleted,
        currweeklybonuscompleted: event.currWeeklyBonusCompleted,
        currweeklybonuscount: event.currWeeklyBonusCount,
        currdailybonuscompleted: event.currDailyBonusCompleted,
        currdailybonuscount: event.currDailyBonusCount,
        currdailybonus: event.currDailyBonus,
        vanguardcredits: event.vanguardCredits,
      })
    })

    this.installHook(mod, "S_LOGIN", 14, (event) => {
      this.LoggedData["starttime"] = Date.now()
      this.LoggedData["templateId"] = event.templateId
      mod.send("C_REQUEST_USER_PAPERDOLL_INFO_WITH_GAMEID", 3, {
        gameId: mod.game.me.gameId,
        zoom: false,
      })
    })
    let rookie = { 0: "true", 1: "false" }
    this.installHook(mod, "S_DUNGEON_CLEAR_COUNT_LIST", 1, (event) => {
      this.LoggedData["dungeon"]["piddungeon"] = event.pid.toString()
      this.LoggedData["dungeon"]["dungeoncont"] = []
      this.LoggedData["dungeon"]["dungeoncont"].splice(0, this.LoggedData["dungeon"]["dungeoncont"].length)
      let char = event.dungeons
      char.forEach((ch) => {
        this.LoggedData["dungeon"]["dungeoncont"].push({
          id: ch.id, //dungeon ID
          name: dungeon[ch.id],
          clears: ch.clears, // clear counter
          rookie: rookie[ch.rookie], // 0 = true 1 = false
        })
      })
    })

    this.installHook(mod, "S_DUNGEON_COOL_TIME_LIST", 3, (e) => {
      let dung = e.dungeons
      dung.forEach((ch) => {
        this.LoggedData["dungeon"]["cooltimePVE"].push({
          id: ch.id,
          name: dungeon[ch.id],
          cooldown: ch.cooldown,
          entriesday: ch.entriesDay,
          entriesweek: ch.entriesWeek,
        })
      })
    })
    this.installHook(mod, "S_DUNGEON_COOL_TIME_LIST", 3, (e) => {
      let battle = e.battlegrounds
      battle.forEach((ch) => {
        this.LoggedData["dungeon"]["cooltimePVP"].push({
          id: ch.id,
          name: dungeon[ch.id],
          entries: ch.entries,
        })
      })
    })

    this.installHook(mod, "S_TRADE_BROKER_REGISTERED_ITEM_LIST", 2, (event) => {
      this.LoggedData["brokerlist"] = []
      this.LoggedData["brokerlist"].splice(0, this.LoggedData["brokerlist"].length)
      let list = event.listings
      list.forEach((ch) => {
        let Prix = ch.price.toString() / 10000
        let temp = ch.time.toString()
        this.LoggedData["brokerlist"].push({
          listing: ch.listing,
          item: ch.item, // DBID
          name: json[ch.item],
          quantity: ch.quantity,
          timeLeft: convertDate(temp),
          price: Prix,
        })
      })
    })

    let size = { 1: "Small", 2: "Medium", 3: "Large" }
    this.installHook(mod, "S_GUILD_MEMBER_LIST", 2, (event) => {
      this.LoggedData["guilddata"] = []
      this.LoggedData["guilddata"].splice(0, this.LoggedData["guilddata"].length)
      this.LoggedData["guilddata"].push({
        guildname: event.guildName,
        guildmaster: event.guildMaster,
        guildlevel: event.guildLevel,
        guildxp: event.guildXp.toString(),
        guildfunds: event.guildFunds.toString(),
        guildid: event.guildId.toString(),
        size: size[event.size], //# 0 = small, 1 = medium, 2 = large
      })
    })

    this.installHook(mod, "S_SYSTEM_MESSAGE_LOOT_ITEM", 1, (event) => {
      if (this.LastGatheringNodePicked && this.LastGatheringNodePickTime && Date.now() - this.LastGatheringNodePickTime < 750) {
        this.LoggedData["gatheringnodeloot"].push({
          id: this.LastGatheringNodePicked["dataId"],
          item: event.item,
          amount: event.amount,
          critical: this.LastGatheringNodePickCritical,
        })
      } else if (this.HasOpenedLootBox && this.LastUseItemTime && Date.now() - this.LastUseItemTime < 2000) {
        this.LoggedData["lootboxes"][this.LoggedData["lootboxes"].length - 1]["drops"].push({
          item: event.item,
          amount: event.amount,
        })
      } else if (this.LastGachaActive) {
        this.LoggedData["gacha"][this.LoggedData["gacha"].length - 1]["drops"].push({
          item: event.item,
          amount: event.amount,
        })
      }
    })

    this.installHook(mod, "S_REQUEST_CONTRACT", 1, (event) => {
      this.HasOpenedLootBox = false
      this.LastGachaActive = false
      this.LastTeleportalID = null
      this.LastTeleportalTime = null

      if (event.type == (mod.majorPatchVersion == 27 ? 16 : 15)) {
        this.LastTeleportalID = event.data.readUInt32LE(4)
        this.LastTeleportalTime = Date.now()
      } else if (event.type == 71) {
        this.LastTeleportalID = event.data.readUInt32LE(0)
        this.LastTeleportalTime = Date.now()
      } else if (event.type == 43) {
        if (this.LastUseItemEvent) {
          this.HasOpenedLootBox = true
          this.LoggedData["lootboxes"].push({
            id: this.LastUseItemEvent.id,
            drops: [],
          })
        }
      }
    })

    this.installHook(mod, "S_RETURN_TO_LOBBY", "raw", (event) => {
      this.finishSession()
    })

    this.installHook(mod, "C_USE_ITEM", 3, (event) => {
      this.HasOpenedLootBox = false
      this.LastGachaActive = false
      this.LastUseItemEvent = event
      this.LastUseItemTime = Date.now()
    })

    this.installHook(mod, "S_SYSTEM_MESSAGE", 1, (event) => {
      let msg = this.mod.parseSystemMessage(event.message)
      switch (msg.id) {
        case "SMT_CANNOT_USE_ITEM_WHILE_CONTRACT":
        case "SMT_CANNOT_CONVERT_EVENT_SEED": {
          this.LastUseItemEvent = null
          this.LastUseItemTime = null
          this.HasOpenedLootBox = false
          break
        }
        case "SMT_GACHA_REWARD": {
          if (msg.tokens.gachaItemName && msg.tokens.randomItemName && msg.tokens.randomItemCount) {
            let gachaItemId = msg.tokens.gachaItemName.replace("@item:", "")
            let randomItemId = msg.tokens.randomItemName.replace("@item:", "")

            if (gachaItemId != 0 && randomItemId != 0) {
              let randomItem = randomItemId + "," + msg.tokens.randomItemCount

              if (!this.LoggedData["gachamsg"][gachaItemId]) this.LoggedData["gachamsg"][gachaItemId] = []

              if (this.LoggedData["gachamsg"][gachaItemId].indexOf(randomItem) < 0) this.LoggedData["gachamsg"][gachaItemId].push(randomItem)
            }
          }
          break
        }
      }
    })

    if (mod.majorPatchVersion < 93) {
      // temporarily disabled until updated properly
      this.installHook(mod, "S_GACHA_START", 1, (event) => {
        this.LastGachaContract = event.id
        this.LastGachaItem = event.gachaItem
      })

      this.installHook(mod, "C_GACHA_TRY", 1, (event) => {
        if (event.id == this.LastGachaContract) {
          this.LastGachaActive = true
          this.LoggedData["gacha"].push({
            id: this.LastGachaItem,
            drops: [],
          })
        } else {
          this.LastGachaActive = false
        }
      })

      this.installHook(mod, "S_GACHA_END", 1, (event) => {
        this.LastGachaContract = null
        this.LastGachaItem = null
        this.LastGachaActive = false
      })
    }

    if (mod.majorPatchVersion >= 77) {
      if (mod.majorPatchVersion >= 53) {
        this.installHook(mod, "S_GMEVENT_GUIDE_MESSAGE", 1, (event) => {
          this.LoggedData["gmevents"]["events"].push({
            type: event.type,
            id: event.id,
            name: event.name,
          })
        })

        this.installHook(mod, "S_GMEVENT_OX_QUIZ_OPEN", 1, (event) => {
          this.LoggedData["gmevents"]["questions"].push(event)
        })

        this.installHook(mod, "S_GMEVENT_OX_QUIZ_RESULT", 1, (event) => {
          this.LoggedData["gmevents"]["answers"].push(event)
        })

        this.installHook(mod, "S_GMEVENT_RECV_REWARD", 2, (event) => {
          event.money = event.money.toString()
          this.LoggedData["gmevents"]["rewards"].push(event)
        })
      }
    }
  }

  storeCurrentGearSet() {
    let glyphs = []
    for (let glyph in this.StateTracker.MyGlyphs) {
      if (this.StateTracker.MyGlyphs[glyph] == 1) glyphs.push(parseInt(glyph))
    }

    let gearset = {
      passivities: this.StateTracker.MyPassivities,
      glyphs: glyphs,
      equipment: this.StateTracker.MyEquipment,
    }

    let gearset_id = crypto.createHash("sha1").update(JSON.stringify(gearset)).digest().toString("hex")

    //if (!this.LoggedData["gearsets"][gearset_id]) this.LoggedData["gearsets"][gearset_id] = gearset;

    return gearset_id
  }

  reset() {
    this.CurrentNPC = null
    this.LastGatheringNodePicked = null
    this.LastGatheringNodePickTime = null
    this.LastGatheringNodePickCritical = null
    this.LastTeleportalID = null
    this.LastTeleportalTime = null
    this.SafeHavenResActive = false
    this.CurDeathLocation = null
    this.LastUseItemEvent = null
    this.LastUseItemTime = null
    this.HasOpenedLootBox = false
    this.LastGachaContract = null
    this.LastGachaItem = null
    this.LastGachaActive = false

    this.LoggedData = {
      version: 1,
      majorPatch: null,
      protocol: null,
      veteran: false,
      accountbenefit: {
        buff: [],
      },
      templateId: null,
      maxcharacters: null,
      guilddata: [],
      hquest: [],
      userpaperdoll: {
        Stats: [],
        Items: [],
      },
      userlist: [],
      carddata: {
        playername: [],
        maxcard: null,
        actualcard: null,
        card: [],
      },
      dungeon: {
        piddungeon: [],
        dungeoncont: [],
        cooltimePVE: [],
        cooltimePVP: [],
      },
      bank: {
        bankgid: [],
        owneridbank: [],
        containetypebank: [],
        moneybank: [],
        bankcont: {
          page1: [],
          page2: [],
          page3: [],
          page4: [],
          page5: [],
          page6: [],
          page7: [],
          page8: [],
        },
      },
      pet: {
        petgid: [],
        owneridpet: [],
        containetypepet: [],
        petcont: {
          page1: [],
          page2: [],
          page3: [],
          page4: [],
          page5: [],
        },
      },
      inventory: {
        invengid: [],
        owneridinv: [],
        moneyinv: [],
        inventorycont: [],
        pocket1: [],
        pocket2: [],
        pocket3: [],
      },
      brokerlist: [],
      lootboxes: [],
      gacha: [],
      gmevents: {
        events: [],
        questions: [],
        answers: [],
        rewards: [],
      },
      gachamsg: {},
    }
  }

  async tryUploadSession(LogData, OnSuccess, OnError, ServerIndex = 0) {
    try {
      const res = await fetch(UploadServerURLs[ServerIndex] + "upload.php", { method: "PUT", body: LogData })
      if (!res.ok) throw Error(`Upload failed with code ${res.status} (${res.statusText})`)

      const data = await res.text()
      if (data !== "OK") throw Error(`Upload failed (${data})`)

      OnSuccess(LogData, ServerIndex)
    } catch (_) {
      // Try the next server
      if (ServerIndex + 1 < UploadServerURLs.length) await this.tryUploadSession(LogData, OnSuccess, OnError, ServerIndex + 1)
      else OnError(LogData, ServerIndex)
    }
  }

  finishSession() {
    // Skip empty/server emulator logs
    if (this.LoggedData["starttime"] !== undefined && !this.isOnServerEmulator) {
      let username_hash = crypto
        .createHash("sha256")
        .update(this.StateTracker.MyAccountName || "")
        .digest()
        .toString("hex")
      let contributor_id = this.StateTracker.MyLanguage.toString() + "-" + username_hash
      this.LoggedData["duration"] = Date.now() - this.LoggedData["starttime"]
      this.LoggedData["language"] = this.StateTracker.MyLanguage // # 0 = INT, 1 = KOR, 2 = USA, 3 = JPN, 4 = GER, 5 = FRA, 6 = EUR, 7 = TW, 8 = RUS
      this.LoggedData["server"] = this.StateTracker.MyServerID
      this.LoggedData["majorPatch"] = this.mod.majorPatchVersion
      this.LoggedData["protocol"] = this.mod.dispatch.protocolVersion
      this.LoggedData["username"] = contributor_id
      this.LoggedData["platform"] = this.mod.platform
      let compressed_log = zlib.gzipSync(JSON.stringify(this.LoggedData, null))
      //let noncompressed_log = JSON.stringify(this.LoggedData);
      let log_folder = path.join(__dirname, "logs")
      this.tryUploadSession(
        compressed_log,
        //noncompressed_log,
        (LogData, ServerIndex) => {
          console.log(`[DataLogger] Log successfully upload - Server ${ServerIndex.toString()} -`)
          // Upload succeeded, retry uploading all previously failed logs
          if (fs.existsSync(log_folder)) {
            fs.readdirSync(log_folder).forEach((file) => {
              let filename = path.join(log_folder, file)
              this.tryUploadSession(
                fs.readFileSync(filename),
                (LogData, ServerIndex) => {
                  try {
                    fs.unlinkSync(filename)
                  } catch (_) {
                    // Ignore
                  }
                },
                (LogData, ServerIndex) => {},
                ServerIndex
              )
            })
          }
        },
        (LogData, ServerIndex) => {
          if (!fs.existsSync(log_folder)) fs.mkdirSync(log_folder)
          fs.writeFileSync(path.join(log_folder, Date.now().toString() + ".json.gz"), LogData)
          //fs.writeFileSync(path.join(log_folder, Date.now().toString() + ".json"), LogData);
          console.log("[DataLogger] Unable to upload the log")
        }
      )
    }
    this.reset()
  }
}

exports.NetworkMod = DataLogger
