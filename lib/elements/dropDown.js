const { setNavigationOptions } = require('../config');
const { descEvent } = require('../eventBus');
const Element = require('./element');
const { defaultConfig } = require('../config');
const { highlightElement } = require('./elementHelper');
const { doActionAwaitingNavigation } = require('../doActionAwaitingNavigation');
const { isRegex } = require('../helper');

class DropDown extends Element {
  async select(value) {
    if (defaultConfig.headful) {
      await highlightElement(this);
    }

    function selectBox(values) {
      let found_value = {};
      let selectAndDispatchEvent = function(self, index) {
        self.selectedIndex = index;
        ['change', 'input'].forEach((ev) => {
          let event = new Event(ev, { bubbles: true });
          try {
            self.dispatchEvent(event);
          } catch (e) {
            return {
              error: `Error occurred while dispatching ${ev} event`,
              stack: e.stack,
            };
          }
        });
        return true;
      };

      if (!values) {
        found_value['isAvailable'] = false;
        return found_value;
      }

      if (this.options.length > values.index) {
        let ele = selectAndDispatchEvent(this, values.index);
        found_value['isAvailable'] = ele;
        return found_value;
      }

      // for (var i = 0; i < this.options.length; i++) {
      //   let option = this.options[i];
      //   if (option.text === values || option.value === values) {
      //     if (option.disabled) {
      //       found_value['isDisabled'] = true;
      //       break;
      //     }
      //     let ele = selectAndDispatchEvent(this, i);
      //     found_value['isAvailable'] = ele;
      //     break;
      //   }
      // }

      let selectOptionsTextMap = {};
      let selectOptionsValueMap = {};
      let selectOptions = this.options;
      let optionsToBeSelectedIndex = [];

      for (let index = 0; index < selectOptions.length; index++) {
        let selectOption = this.options[index];

        selectOptionsTextMap[selectOption.text] = index;
        selectOptionsValueMap[selectOption.value] = index;
      }

      for (let index = 0; index < values.length; index++) {
        let value = values[index];
        // console.log('value-->', value);
        let isPresentInTextSet = selectOptionsTextMap[value];
        let isPresentInValueSet = selectOptionsValueMap[value];

        if (!isPresentInTextSet && !isPresentInValueSet) {
          // console.log('inside if');
          return found_value;
        }

        let optionIndex = selectOptionsTextMap[value];
        optionsToBeSelectedIndex.push(optionIndex);

        found_value['isAvailable'] = selectAndDispatchEvent(this, optionsToBeSelectedIndex);
        console.log('found_value--->', found_value);
      }

      // console.log('selected indexes', optionsToBeSelectedIndex);
      // found_value['isAvailable'] = selectAndDispatchEvent(this, optionsToBeSelectedIndex);
      // console.log('found_value--->', found_value);
      return found_value;
    }

    const options = setNavigationOptions({});

    // RegExp is not serialised. So loop through dropdown text and find a match
    // before invoking via CDP API
    let valueToSelect = value;
    if (isRegex(value)) {
      let options = await this.text();
      valueToSelect = await options.split('\n').find((option) => value.exec(option));
    }

    await doActionAwaitingNavigation(options, async () => {
      const { result } = await this.runtimeHandler.runtimeCallFunctionOn(selectBox, null, {
        objectId: this.get(),
        arg: valueToSelect,
        returnByValue: true,
      });
      const { stack, error } = result.value;
      console.log('Result', result.type.isMultiple);
      if (stack) {
        throw new Error(error + '\n' + stack);
      }
      if (result.value.isDisabled) {
        throw new Error(`Cannot set value ${value} on a disabled field`);
      }
      if (!result.value.isAvailable) {
        throw new Error(`Option ${value} not available in drop down`);
      }
    });
    descEvent.emit('success', 'Selected ' + (value.index || value));
  }
  async value() {
    function getValue() {
      if (this.value) {
        return this.value;
      }
      return this.innerText;
    }

    const { result } = await this.runtimeHandler.runtimeCallFunctionOn(getValue, null, {
      objectId: this.get(),
    });
    return result.value;
  }

  async options() {
    function getOptions() {
      let dropDownValues = [];
      for (let index = 0; index < this.options.length; index++) {
        dropDownValues.push(this.options[index].value);
      }
      return dropDownValues;
    }

    const { result } = await this.runtimeHandler.runtimeCallFunctionOn(getOptions, null, {
      objectId: this.get(),
      returnByValue: true,
    });
    return result.value;
  }

  static from(element, description) {
    return new DropDown(element.get(), description, element.runtimeHandler);
  }
}

module.exports = DropDown;
