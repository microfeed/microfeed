export default class Podcast {
  constructor(env) {
    const {LISTEN_HOST_VERSION, LH_DB} = env;
    this.KEY = `${LISTEN_HOST_VERSION}:pod:meta`;
    this.LH_DB = LH_DB;
    this.currentValueDict = null;
  }

  async getValue() {
    this.currentValueDict = await this.LH_DB.get(this.KEY, {type: 'json'});
    return this.currentValueDict;
  }

  async setValue(valueDict) {
    await this.LH_DB.put(this.KEY, JSON.stringify(valueDict));
    this.currentValueDict = valueDict;
    return this.currentValueDict;
  }

  async updateValue(valueDict) {
    if (this.currentValueDict) {
      this.currentValueDict = {
        ...this.currentValueDict,
        ...valueDict,
      };
    } else {
      this.currentValueDict = valueDict;
    }
    return await this.setValue(this.currentValueDict);
  }
}
