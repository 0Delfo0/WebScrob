import { TrackingService } from '../base/TrackingService'
// import { Tracking } from '../base/TrackingType'

import * as _ from 'lodash'

const request = require('request')
const xml2js = require('xml2js').parseString

const createXMLForm = (json) => {
  let generated = ''
  _.each(json, (val, key) => {
    generated += `<${key}>${val}</${key}>`
  })
  return { data: `<?xml version="1.0" encoding="UTF-8"?><entry>${generated}</entry>` }
}

export class Trakt extends TrackingService {
  authorization () {
    const joined = `${this.user}:${this.pass}`
    const b64 = Buffer.from(joined).toString('base64')
    return `Basic ${b64}`
  }

  verifyCredentials () {
    return this.useAPI(this.api('account/verify_credentials.xml'), {})
  }

  api (suffix) {
    return `https://myanimelist.net/api/${suffix}`
  }

  anime (suffix) {
    return this.api(`anime/${suffix}`)
  }

  animelist (suffix) {
    return this.api(`animelist/${suffix}`)
  }

  manga (suffix) {
    return this.api(`manga/${suffix}`)
  }

  mangalist (suffix) {
    return this.api(`mangalist/${suffix}`)
  }

  addAnime (id, json) {
    return this.useAPI(this.animelist(`add/${id}.xml`), createXMLForm(json))
  }

  updateAnime (id, json) {
    return this.useAPI(this.animelist(`update/${id}.xml`), createXMLForm(json))
  }

  addManga (id, json) {
    return this.useAPI(this.mangalist(`add/${id}.xml`), createXMLForm(json))
  }

  updateManga (id, json) {
    return this.useAPI(this.mangalist(`update/${id}.xml`), createXMLForm(json))
  }

  search (apiURL, query) {
    return new Promise((resolve, reject) =>
      this.useAPI(apiURL, { q: query })
        .then((result) => {
          xml2js(result.content, (err, res) => {
            if (err) {
              reject(err)
            } else {
              if (!res) {
                reject('No matching entry found')
              } else {
                resolve(apiURL.indexOf('/manga') >= 0 ? res.manga.entry[0] : res.anime.entry[0])
              }
            }
          })
        }).catch((err) => reject(err)))
  }

  searchAnime (query) {
    return this.search(this.anime('search.xml'), query)
  }

  searchManga (query) {
    return this.search(this.manga('search.xml'), query)
  }

  appinfo (id, type = 'anime') {
    return new Promise((resolve, reject) => {
      let url = `https://myanimelist.net/malappinfo.php?u=${this.user}&status=1&type=${type}`
      request({
        uri: url
      }, (error, response, body) => {
        if (error) {
          reject(error)
        } else {
          xml2js(body, (err, res) => {
            if (err) {
              reject(err)
            } else {
              resolve(res)
            }
          })
        }
      })
    })
  }

  findListEntry (id, type = 'anime') {
    return new Promise((resolve, reject) => {
      let usingAnime = (type === 'anime')
      this.appinfo(id, type)
        .then(result => {
          let array = (usingAnime ? result.myanimelist.anime : result.myanimelist.manga)
          let match = _.find(array, (entry) => {
            let idArray = (usingAnime ? entry.series_animedb_id : entry.series_mangadb_id)
            return idArray[0] === id.toString()
          })
          resolve(match)
        })
        .catch(err => reject(err))
    })
  }

  checkEpisode (id, type = 'anime') {
    return new Promise((resolve, reject) => {
      let usingAnime = (type === 'anime')
      this.findListEntry(id, type)
        .then(result => {
          if (result) {
            resolve(parseInt(usingAnime ? result.my_watched_episodes : result.my_read_chapters))
          } else {
            resolve(0)
          }
        })
        .catch(err => reject(err))
    })
  }

  updateAnimeList (id, status, episode) {
    return new Promise((resolve, reject) => {
      this.findListEntry(id)
        .then(result => {
          if (result !== undefined) {
            this.updateAnime(id, { status, episode })
              .then(res => resolve(res))
              .catch(err => reject(err))
          } else {
            this.addAnime(id, { status, episode })
              .then(res => resolve(res))
              .catch(err => reject(err))
          }
        })
    })
  }
}
