<script>
    import {onMount} from "svelte";
    import axios from 'axios';
    import {writable} from 'svelte/store'

    export const apiUrl = import.meta.env.VITE_API_URL
    export const devicesDataStore = writable([]);
    export const globalPowerState = writable(false)
    export let totp = {
        token: '',
        valid: false
    }

    // import DeviceCard from "./DeviceCard.svelte";

    const isTotpSet = (totp = {token: '', valid: false}) => {
        if (totp.token.length < 6) {
            return {class: "text-amber-500 font-bold bg-indigo-900", text: 'Set TOTP'}
        }

        if (totp.valid === true) {
            return {class: "text-white font-bold bg-green-500", text: 'TOTP is Valid'}
        }

        return {class: "text-indigo-900 font-bold bg-amber-500", text: 'TOTP invalid'}
    }

    $: totpIsSet = isTotpSet(totp)

    const validateTOTP = (inputEvent) => {
        let _totp = {
            // max length of 6, numeric only
            token: inputEvent.target.value.replace(/[^0-9]/g, '').slice(0, 6),
            valid: undefined
        }
        if (_totp.token.length === 6) {
            axios.post(`${apiUrl}/validateTotp`, {
                totp: _totp.token
            }).then(res => {
                totp.token = res.data.totp.token
                totp.valid = res.data.totp.valid
            })
        }
    }


    onMount(async () => {
        let res = await axios.get(apiUrl)
        devicesDataStore.set(res.data)
    })

    export const getPowerState = (device) => {
        const foundDevice = $devicesDataStore.find(i => i.host === device.host);
        return foundDevice ? foundDevice.powerState : null;
    }

    export const getClassByPowerState = (device) => {
        // initial state when powerState === false
        const res = {
            outer: "border border-2 border-white rounded-md p-2 bg-white text-gray-900",
            inner: "border border-2 border-indigo-900 rounded-md m-2 px-4 py-2 grid auto-cols-auto auto-rows-auto gap-1",
        }
        const powerState = getPowerState(device)
        if (powerState === true) {
            res.outer = "border border-2 border-white rounded-md p-2 bg-white text-gray-900"
            res.inner = "border border-2 border-amber-500 rounded-md m-2 px-4 py-2 grid auto-cols-auto auto-rows-auto gap-1"
        }

        return res
    }

    export const toggleGlobalPowerState = async (devices) => {
        if (totp.valid !== true) {
            return null
        }

        const _globalPowerState = !$globalPowerState
        let res
        try {
            res = await axios.post(`${apiUrl}/submit`, {
                hosts: devices.map(i => i.host),
                powerState: _globalPowerState,
                totp: totp
            })
        } catch (error) {
            if (error.code && error.code === "ERR_NETWORK") {
                console.log('TOTP expired')
                totp.valid = false
                return
            } else {
                console.log('error', error)
                return
            }
        }


        globalPowerState.set(_globalPowerState);
        devicesDataStore.update(state => {
            return state.map(i => {
                return {...i, powerState: _globalPowerState}
            })
        })
        devicesDataStore.update(data => {
            data = res.data;
            return data;
        });
    }

    export const toggleDevicePowerState = async (device) => {
        if (totp.valid !== true) {
            return null
        }

        let res
        try {
            res = await axios.post(`${apiUrl}/submit`, {
                hosts: [device.host],
                powerState: !device.powerState,
                totp: totp
            })
        } catch (error) {
            if (error.code && error.code === "ERR_NETWORK") {
                console.log('TOTP expired')
                totp.valid = false
                return
            } else {
                console.log('error', error)
                return
            }
        }

        devicesDataStore.update(state => {
            return state.map(i => {
                return {
                    ...i,
                    powerState: i.host === device.host ? !device.powerState : i.powerState
                }
            })
        })

        devicesDataStore.update(data => {
            data = res.data;
            return data;
        });
    }

</script>

<main>
    <h1 class="py-8 px-4 border border-indigo-900 shadow-lg">Devices</h1>
</main>

<div class="bg-neutral-50">
    <div class="block border border-2 border-gray-200 p-2 flex flex-row gap-2">
        <input type="text" class="text-indigo-900 font-medium px-2 rounded-md" bind:value={totp.token}
               on:input={validateTOTP}/>
        <p class={isTotpSet(totp).class}>{isTotpSet(totp).text}</p>
    </div>

    <div class="block border border-2 border-gray-200 p-2">
        {#await $devicesDataStore}
            <pre>{JSON.stringify({loading: true})}</pre>
        {:then data}
            <a on:click={() => toggleGlobalPowerState(data)}>
                <div class={$globalPowerState}>
                    <div class="border border-2 border-amber-500 m-2 grid auto-cols-auto auto-rows-auto gap-1 px-4">
                        <div class="text-left">
                            <h1>All</h1>
                            <h3>Attached Devices: <br>{JSON.stringify(data.map(i => i.attachedDevices))}</h3>
                        </div>
                    </div>
                    <div>
                        <p class="text-bold text-center">
                            {$globalPowerState === true ? '🌝' : '🌚'}
                        </p>
                    </div>
                </div>
            </a>
        {/await}
    </div>
    <div class="block border border-2 border-gray-200 p-2 bg-indigo-900">
        {#await $devicesDataStore}
            <pre>{JSON.stringify({loading: true})}</pre>
        {:then data}
            <div class="
                flex flex-row flex-wrap
                gap-1
            ">
                {#each data as each}
                    <a on:click={() => toggleDevicePowerState(each)}>
                        <div class={getClassByPowerState(each).outer}>
                            <div class={getClassByPowerState(each).inner}>
                                <div class="
                                    text-bold text-left
                                    grid grid-cols-2 grid-rows-1
                                ">
                                    <div class="col-span-1">
                                        <h1>{each.room}</h1>
                                        <br/>
                                        {each.powerState === true ? '🌝' : '🌚'}
                                    </div>
                                    <div class="col-span-1">
                                        <h3>Attached Devices: <br>{JSON.stringify(each.attachedDevices)}</h3>
                                        <h3>Power: {each.powerState === true ? 'On' : 'Off'} </h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>

                {/each}
            </div>
        {/await}
    </div>
</div>
